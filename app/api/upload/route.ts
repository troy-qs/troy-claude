import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { recognizeExamPaper } from '@/lib/claude'
import { saveSession, saveImage } from '@/lib/db'
import type { LearningSession } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const studentName = formData.get('studentName') as string || '同学'
    const examName = formData.get('examName') as string || '化学试卷'

    if (!file) {
      return NextResponse.json({ error: '请上传试卷图片' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '请上传 JPG、PNG 或 WebP 格式的图片' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // 保存图片
    const imageId = uuidv4()
    saveImage(imageId, null, file.name, file.type, buffer)

    // OCR 识别
    const questions = await recognizeExamPaper(base64, file.type)

    const wrongQuestions = questions.filter((q) => !q.isCorrect)

    const sessionId = uuidv4()
    const session: LearningSession = {
      id: sessionId,
      studentName,
      subject: 'chemistry',
      examName,
      uploadedAt: new Date().toISOString(),
      totalQuestions: questions.length,
      wrongQuestions: wrongQuestions.length,
      questions,
      analyses: [],
      verificationQuestions: [],
      topicMastery: [],
      overallProgress: 0,
    }

    saveSession(session)

    return NextResponse.json({ sessionId, questions, wrongCount: wrongQuestions.length })
  } catch (error) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : '识别失败，请重试'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
