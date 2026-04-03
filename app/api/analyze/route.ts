import { NextRequest, NextResponse } from 'next/server'
import { analyzeError, generateVerificationQuestions } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/db'
import type { TopicMastery } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, questionId } = await req.json()

    if (!sessionId || !questionId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    const session = getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: '找不到学习记录' }, { status: 404 })
    }

    const question = session.questions.find((q) => q.id === questionId)
    if (!question) {
      return NextResponse.json({ error: '找不到该题目' }, { status: 404 })
    }

    // 检查是否已分析过
    const existingAnalysis = session.analyses.find((a) => a.questionId === questionId)
    if (existingAnalysis) {
      const existingVerifications = session.verificationQuestions.filter(
        (v) => v.parentErrorId === questionId
      )
      return NextResponse.json({
        analysis: existingAnalysis,
        verificationQuestions: existingVerifications,
      })
    }

    // 分析错误原因
    const analysis = await analyzeError(question)

    // 生成验证题
    const verificationQuestions = await generateVerificationQuestions(question, analysis)

    // 更新session
    session.analyses.push(analysis)
    session.verificationQuestions.push(...verificationQuestions)

    // 更新知识点掌握状态
    const existingTopic = session.topicMastery.find((t) => t.topic === question.topic)
    if (!existingTopic) {
      const newTopic: TopicMastery = {
        topic: question.topic,
        status: 'learning',
        correctCount: 0,
        totalAttempts: 0,
      }
      session.topicMastery.push(newTopic)
    }

    saveSession(session)

    return NextResponse.json({ analysis, verificationQuestions })
  } catch (error) {
    console.error('Analyze error:', error)
    const message = error instanceof Error ? error.message : '分析失败，请重试'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
