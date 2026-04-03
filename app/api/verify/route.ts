import { NextRequest, NextResponse } from 'next/server'
import { evaluateVerificationAnswer } from '@/lib/claude'
import { getSession, saveSession } from '@/lib/db'
import type { MasteryStatus } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, verificationQuestionId, studentAnswer } = await req.json()

    if (!sessionId || !verificationQuestionId || studentAnswer === undefined) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    const session = getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: '找不到学习记录' }, { status: 404 })
    }

    const vqIndex = session.verificationQuestions.findIndex(
      (v) => v.id === verificationQuestionId
    )
    if (vqIndex === -1) {
      return NextResponse.json({ error: '找不到该验证题' }, { status: 404 })
    }

    const vq = session.verificationQuestions[vqIndex]

    // 评估答案
    const evaluation = await evaluateVerificationAnswer(vq, studentAnswer)

    // 更新验证题状态
    session.verificationQuestions[vqIndex] = {
      ...vq,
      studentAnswer,
      isCorrect: evaluation.isCorrect,
      attemptedAt: new Date().toISOString(),
    }

    // 更新知识点掌握状态
    const originalQuestion = session.questions.find((q) => q.id === vq.parentErrorId)
    if (originalQuestion) {
      const topicIndex = session.topicMastery.findIndex(
        (t) => t.topic === originalQuestion.topic
      )
      if (topicIndex !== -1) {
        const topic = session.topicMastery[topicIndex]
        topic.totalAttempts += 1
        if (evaluation.isCorrect) topic.correctCount += 1
        topic.lastAttemptAt = new Date().toISOString()

        // 判断掌握状态
        const sibling = session.verificationQuestions.filter(
          (v) => v.parentErrorId === vq.parentErrorId && v.id !== vq.id
        )
        const allAttempted = sibling.every((v) => v.isCorrect !== undefined)
        const allCorrect =
          evaluation.isCorrect && sibling.every((v) => v.isCorrect === true)

        let status: MasteryStatus = 'learning'
        if (allAttempted && allCorrect) {
          status = 'mastered'
        } else if (allAttempted && !allCorrect) {
          status = 'needs_review'
        }
        topic.status = status
        session.topicMastery[topicIndex] = topic
      }
    }

    // 计算总体进度
    const masteredCount = session.topicMastery.filter(
      (t) => t.status === 'mastered'
    ).length
    session.overallProgress =
      session.topicMastery.length > 0
        ? Math.round((masteredCount / session.topicMastery.length) * 100)
        : 0

    saveSession(session)

    return NextResponse.json({
      evaluation,
      updatedSession: {
        topicMastery: session.topicMastery,
        overallProgress: session.overallProgress,
      },
    })
  } catch (error) {
    console.error('Verify error:', error)
    const message = error instanceof Error ? error.message : '评估失败，请重试'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
