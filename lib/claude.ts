import OpenAI from 'openai'
import type {
  RecognizedQuestion,
  ErrorAnalysis,
  ErrorType,
  VerificationQuestion,
} from './types'
import { v4 as uuidv4 } from 'uuid'

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
})

// 视觉识别用视觉模型，文字分析用长文本模型
const VISION_MODEL = 'moonshot-v1-32k-vision-preview'
const TEXT_MODEL = 'moonshot-v1-32k'

const SYSTEM_PROMPT = `你是一位专门辅导大连市初三化学中考的AI老师。
学生就读于高新技术产业园区第一中学，今年6月参加大连市中考。
使用人教版化学教材，考试总分60分（笔试50分+实验10分）。

你的核心职责：
1. 精准分析学生为什么做错（不是泛泛讲知识点）
2. 讲解要直击错误原因，口语化，让初三孩子能听懂
3. 出的验证题要针对同类错误陷阱，检验是否真正理解

请始终用简单、亲切的语气，像一个耐心的家教老师。`

// 试卷图片OCR识别
export async function recognizeExamPaper(
  imageBase64: string,
  mimeType: string
): Promise<RecognizedQuestion[]> {
  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: `请仔细分析这张化学试卷图片，识别出所有题目。

请以JSON格式返回，格式如下：
{
  "questions": [
    {
      "questionNumber": "题号，如1、2(1)、3",
      "questionText": "题目完整内容",
      "questionType": "choice|fill|short_answer|calculation",
      "studentAnswer": "学生写的答案（如果能看到）",
      "correctAnswer": "正确答案（如果试卷上有批改标注）",
      "isCorrect": true或false,
      "score": 该题分值（如果能识别，否则填0）,
      "topic": "所属化学知识点，如：酸碱盐、化学方程式、物质的分类、溶液、氧化还原等"
    }
  ]
}

注意：
- studentAnswer 填学生实际写的内容
- correctAnswer 填红笔批改的正确答案，或根据化学知识判断正确答案
- isCorrect 根据批改标记或答案比对判断
- 如果某项信息不明确，填空字符串""
- 只返回JSON，不要有其他内容`,
          },
        ],
      },
    ],
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('识别失败，请确保图片清晰')

  const parsed = JSON.parse(jsonMatch[0])
  return parsed.questions.map((q: Omit<RecognizedQuestion, 'id'>) => ({
    ...q,
    id: uuidv4(),
    score: q.score || 0,
  }))
}

// 错误原因分析
export async function analyzeError(
  question: RecognizedQuestion
): Promise<ErrorAnalysis> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请分析这道化学题的错误原因：

题目：${question.questionText}
学生的答案：${question.studentAnswer}
正确答案：${question.correctAnswer}
知识点：${question.topic}

请以JSON格式返回分析结果：
{
  "errorType": "careless|concept_confusion|knowledge_gap|misreading|method_unclear",
  "errorReason": "具体说明学生为什么错，要针对这个学生的这个具体答案，不超过100字",
  "keyMisunderstanding": "核心误解点，一句话概括",
  "explanation": "针对这个错误原因的讲解，直击要害，不要泛泛复习整个知识点，200字以内，口语化",
  "tipsForStudent": "给学生的温馨提示，口语化，鼓励性的，50字以内"
}

errorType说明：
- careless: 粗心失误（计算错、抄错、看错符号）
- concept_confusion: 概念混淆（把A知识点当B用）
- knowledge_gap: 知识缺失（完全不知道这个知识点）
- misreading: 审题偏差（读错题意）
- method_unclear: 方法不熟（知道但步骤混乱）

只返回JSON，不要有其他内容`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('分析失败，请重试')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    questionId: question.id,
    errorType: parsed.errorType as ErrorType,
    errorReason: parsed.errorReason,
    keyMisunderstanding: parsed.keyMisunderstanding,
    explanation: parsed.explanation,
    tipsForStudent: parsed.tipsForStudent,
  }
}

// 生成验证题
export async function generateVerificationQuestions(
  question: RecognizedQuestion,
  analysis: ErrorAnalysis
): Promise<VerificationQuestion[]> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `根据学生的错误，生成2道验证题来检验学生是否真正理解了。

原题：${question.questionText}
错误类型：${analysis.errorType}
错误原因：${analysis.errorReason}
核心误解：${analysis.keyMisunderstanding}

要求：
1. 第1题：和原题同类型，包含相同的易错陷阱，验证学生是否还会犯同样的错
2. 第2题：换一种表述方式，考查同样的知识点但角度不同，验证是否真正理解

请以JSON格式返回：
{
  "questions": [
    {
      "questionText": "题目内容",
      "questionType": "choice|fill|short_answer|calculation",
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "correctAnswer": "正确答案",
      "trapDescription": "这道题设置了什么陷阱，为什么容易错，一句话"
    }
  ]
}

注意：options字段只有选择题才需要，其他题型不要包含此字段。
只返回JSON，不要有其他内容`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('生成验证题失败，请重试')

  const parsed = JSON.parse(jsonMatch[0])
  return parsed.questions.map((q: Omit<VerificationQuestion, 'id' | 'parentErrorId' | 'targetErrorType'>) => ({
    ...q,
    id: uuidv4(),
    parentErrorId: question.id,
    targetErrorType: analysis.errorType,
    options: q.options || undefined,
  }))
}

// 判断学生回答验证题是否正确
export async function evaluateVerificationAnswer(
  verificationQuestion: VerificationQuestion,
  studentAnswer: string
): Promise<{
  isCorrect: boolean
  feedback: string
  stillHasError: boolean
  errorDetail?: string
}> {
  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `判断学生对这道验证题的回答是否正确：

题目：${verificationQuestion.questionText}
正确答案：${verificationQuestion.correctAnswer}
学生的答案：${studentAnswer}
这道题的陷阱：${verificationQuestion.trapDescription}

请以JSON格式返回：
{
  "isCorrect": true或false,
  "stillHasError": true或false,
  "feedback": "针对学生这个答案的反馈，口语化，50字以内",
  "errorDetail": "如果还是错了，具体哪里错了（可选）"
}

只返回JSON，不要有其他内容`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('评估失败，请重试')

  return JSON.parse(jsonMatch[0])
}
