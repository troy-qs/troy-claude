// 错误类型分类
export type ErrorType =
  | 'careless'        // 粗心：计算错、抄错数字、看错符号
  | 'concept_confusion' // 概念混淆：把A知识点当B用
  | 'knowledge_gap'   // 知识缺失：根本不知道这个知识点
  | 'misreading'      // 理解偏差：题意理解错
  | 'method_unclear'  // 方法不熟：知道但不会用

export interface ErrorTypeInfo {
  type: ErrorType
  label: string
  description: string
  strategy: string
}

export const ERROR_TYPE_INFO: Record<ErrorType, ErrorTypeInfo> = {
  careless: {
    type: 'careless',
    label: '粗心失误',
    description: '计算错误、抄错数字、看错符号等',
    strategy: '出同类计算题，观察是否重复犯同样错误',
  },
  concept_confusion: {
    type: 'concept_confusion',
    label: '概念混淆',
    description: '把一个知识点当另一个用',
    strategy: '讲清楚两个概念的区别，出对比辨析题',
  },
  knowledge_gap: {
    type: 'knowledge_gap',
    label: '知识缺失',
    description: '这个知识点没有掌握或从未学过',
    strategy: '从基础讲起，逐步递进',
  },
  misreading: {
    type: 'misreading',
    label: '审题偏差',
    description: '知道知识点但题意理解错了',
    strategy: '出同类型但表述不同的题，测试读题能力',
  },
  method_unclear: {
    type: 'method_unclear',
    label: '方法不熟',
    description: '知道知识点但不会运用解题步骤',
    strategy: '出步骤引导题，帮助建立解题方法',
  },
}

// 试卷中识别出的单道题目
export interface RecognizedQuestion {
  id: string
  questionNumber: string   // 题号，如 "1", "2(1)", "3"
  questionText: string     // 题目原文
  questionType: 'choice' | 'fill' | 'short_answer' | 'calculation'
  studentAnswer: string    // 学生的答案
  correctAnswer: string    // 正确答案
  isCorrect: boolean
  score: number            // 该题分值
  topic: string            // 所属知识点，如 "酸碱盐", "化学方程式"
}

// 错题分析结果
export interface ErrorAnalysis {
  questionId: string
  errorType: ErrorType
  errorReason: string      // 具体说明孩子为什么错，针对性的描述
  keyMisunderstanding: string  // 核心误解点
  explanation: string      // 针对错因的讲解（不是泛泛复习）
  tipsForStudent: string   // 给孩子的提示语，口语化
}

// 验证题
export interface VerificationQuestion {
  id: string
  parentErrorId: string    // 对应的原始错题id
  questionText: string
  questionType: 'choice' | 'fill' | 'short_answer' | 'calculation'
  options?: string[]       // 选择题选项
  correctAnswer: string
  targetErrorType: ErrorType  // 这道题在验证哪类错误
  trapDescription: string  // 这道题设置了什么陷阱
  studentAnswer?: string
  isCorrect?: boolean
  attemptedAt?: string
}

// 掌握状态
export type MasteryStatus = 'not_started' | 'learning' | 'mastered' | 'needs_review'

// 知识点掌握记录
export interface TopicMastery {
  topic: string
  status: MasteryStatus
  correctCount: number
  totalAttempts: number
  lastAttemptAt?: string
}

// 学习会话（一次上传试卷）
export interface LearningSession {
  id: string
  studentName: string
  subject: string          // 'chemistry'
  examName: string         // 如 "2025年3月月考"
  uploadedAt: string
  totalQuestions: number
  wrongQuestions: number
  questions: RecognizedQuestion[]
  analyses: ErrorAnalysis[]
  verificationQuestions: VerificationQuestion[]
  topicMastery: TopicMastery[]
  overallProgress: number  // 0-100
}
