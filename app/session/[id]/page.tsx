'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import type { LearningSession, RecognizedQuestion, ErrorAnalysis, VerificationQuestion } from '@/lib/types'
import { ERROR_TYPE_INFO } from '@/lib/types'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

type ViewState = 'overview' | 'learning'

export default function SessionPage({ params }: SessionPageProps) {
  const { id } = use(params)
  const [session, setSession] = useState<LearningSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewState>('overview')
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null)

  // 分析状态
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [currentAnalysis, setCurrentAnalysis] = useState<ErrorAnalysis | null>(null)
  const [currentVerifications, setCurrentVerifications] = useState<VerificationQuestion[]>([])

  // 答题状态
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [feedbacks, setFeedbacks] = useState<Record<string, { isCorrect: boolean; feedback: string; stillHasError: boolean }>>({})

  useEffect(() => {
    fetchSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      const data = await res.json()
      if (res.ok) setSession(data.session)
    } finally {
      setLoading(false)
    }
  }

  const startLearning = async (question: RecognizedQuestion) => {
    setView('learning')
    setActiveQuestionId(question.id)
    setCurrentAnalysis(null)
    setCurrentVerifications([])

    // 检查是否已有分析
    if (session) {
      const existing = session.analyses.find((a) => a.questionId === question.id)
      if (existing) {
        setCurrentAnalysis(existing)
        setCurrentVerifications(session.verificationQuestions.filter((v) => v.parentErrorId === question.id))
        return
      }
    }

    setAnalyzing(question.id)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, questionId: question.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setCurrentAnalysis(data.analysis)
        setCurrentVerifications(data.verificationQuestions)
        await fetchSession()
      }
    } finally {
      setAnalyzing(null)
    }
  }

  const submitAnswer = async (vqId: string) => {
    const answer = answers[vqId]
    if (!answer?.trim()) return

    setSubmitting(vqId)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, verificationQuestionId: vqId, studentAnswer: answer }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedbacks((prev) => ({ ...prev, [vqId]: data.evaluation }))
        if (data.updatedSession) {
          setSession((prev) => prev ? { ...prev, ...data.updatedSession } : prev)
        }
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">找不到该学习记录</p>
          <Link href="/" className="text-blue-600 text-sm hover:underline">返回首页</Link>
        </div>
      </div>
    )
  }

  const wrongQuestions = session.questions.filter((q) => !q.isCorrect)
  const activeQuestion = session.questions.find((q) => q.id === activeQuestionId)

  return (
    <main className="flex-1 flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {view === 'learning' ? (
            <button onClick={() => setView('overview')} className="text-slate-500 hover:text-slate-700 p-1 -ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <Link href="/" className="text-slate-500 hover:text-slate-700 p-1 -ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-slate-900 truncate">{session.examName}</h1>
            <p className="text-xs text-slate-500">{session.studentName} · 化学</p>
          </div>
          {/* 总体进度 */}
          {session.topicMastery.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-500">已掌握</p>
              <p className="text-sm font-bold text-blue-600">{session.overallProgress}%</p>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        {view === 'overview' && (
          <OverviewView
            session={session}
            wrongQuestions={wrongQuestions}
            onStartLearning={startLearning}
          />
        )}

        {view === 'learning' && activeQuestion && (
          <LearningView
            question={activeQuestion}
            analysis={currentAnalysis}
            verificationQuestions={currentVerifications}
            analyzing={analyzing === activeQuestion.id}
            answers={answers}
            setAnswers={setAnswers}
            submitting={submitting}
            feedbacks={feedbacks}
            onSubmitAnswer={submitAnswer}
          />
        )}
      </div>
    </main>
  )
}

// ---- 总览视图 ----
function OverviewView({
  session,
  wrongQuestions,
  onStartLearning,
}: {
  session: LearningSession
  wrongQuestions: RecognizedQuestion[]
  onStartLearning: (q: RecognizedQuestion) => void
}) {
  const masteredTopics = session.topicMastery.filter((t) => t.status === 'mastered').length
  const analyzedIds = new Set(session.analyses.map((a) => a.questionId))

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="总题数" value={session.totalQuestions} color="slate" />
        <StatCard label="错题数" value={session.wrongQuestions} color="red" />
        <StatCard label="已掌握" value={`${masteredTopics}/${session.topicMastery.length}`} color="green" />
      </div>

      {/* 知识点掌握进度 */}
      {session.topicMastery.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">知识点掌握情况</h2>
          <div className="space-y-2">
            {session.topicMastery.map((topic) => (
              <div key={topic.topic} className="flex items-center gap-2">
                <div className="flex-1 text-sm text-slate-700 truncate">{topic.topic}</div>
                <MasteryBadge status={topic.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错题列表 */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          错题列表 <span className="text-slate-400 font-normal">（点击开始学习）</span>
        </h2>
        {wrongQuestions.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-green-700 font-medium">太棒了！这次没有错题</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wrongQuestions.map((q) => {
              const analysis = session.analyses.find((a) => a.questionId === q.id)
              const masteryTopic = session.topicMastery.find((t) => t.topic === q.topic)
              return (
                <button
                  key={q.id}
                  onClick={() => onStartLearning(q)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 p-4
                    hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded mt-0.5 shrink-0">
                      第{q.questionNumber}题
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 line-clamp-2">{q.questionText}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {q.topic}
                        </span>
                        {analysis && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            {ERROR_TYPE_INFO[analysis.errorType].label}
                          </span>
                        )}
                        {masteryTopic && <MasteryBadge status={masteryTopic.status} />}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1 transition-colors"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- 学习视图 ----
function LearningView({
  question,
  analysis,
  verificationQuestions,
  analyzing,
  answers,
  setAnswers,
  submitting,
  feedbacks,
  onSubmitAnswer,
}: {
  question: RecognizedQuestion
  analysis: ErrorAnalysis | null
  verificationQuestions: VerificationQuestion[]
  analyzing: boolean
  answers: Record<string, string>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  submitting: string | null
  feedbacks: Record<string, { isCorrect: boolean; feedback: string; stillHasError: boolean }>
  onSubmitAnswer: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* 原题 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            第{question.questionNumber}题
          </span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{question.topic}</span>
        </div>
        <p className="text-sm text-slate-800 mb-3">{question.questionText}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-500 font-medium mb-1">你的答案</p>
            <p className="text-sm text-red-700">{question.studentAnswer || '（未作答）'}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-500 font-medium mb-1">正确答案</p>
            <p className="text-sm text-green-700">{question.correctAnswer}</p>
          </div>
        </div>
      </div>

      {/* 分析中 */}
      {analyzing && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-blue-700 font-medium">AI正在分析你为什么做错...</p>
          <p className="text-xs text-blue-500 mt-1">同时准备验证题，稍等一下</p>
        </div>
      )}

      {/* 错误分析 */}
      {analysis && !analyzing && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${errorTypeColor(analysis.errorType)}`}>
                {ERROR_TYPE_INFO[analysis.errorType].label}
              </span>
              <span className="text-xs text-slate-500">错误原因</span>
            </div>
            <p className="text-sm text-slate-800 mb-3 font-medium">{analysis.errorReason}</p>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium mb-1">核心误解</p>
              <p className="text-sm text-amber-800">{analysis.keyMisunderstanding}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 mb-2">针对性讲解</p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{analysis.explanation}</p>
            <div className="mt-3 bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600">{analysis.tipsForStudent}</p>
            </div>
          </div>

          {/* 验证题 */}
          {verificationQuestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                验证一下，你真的懂了吗？
              </h3>
              <div className="space-y-4">
                {verificationQuestions.map((vq, idx) => (
                  <VerificationCard
                    key={vq.id}
                    vq={vq}
                    index={idx + 1}
                    answer={answers[vq.id] || ''}
                    onAnswerChange={(val) => setAnswers((prev) => ({ ...prev, [vq.id]: val }))}
                    submitting={submitting === vq.id}
                    feedback={feedbacks[vq.id]}
                    onSubmit={() => onSubmitAnswer(vq.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- 验证题卡片 ----
function VerificationCard({
  vq,
  index,
  answer,
  onAnswerChange,
  submitting,
  feedback,
  onSubmit,
}: {
  vq: VerificationQuestion
  index: number
  answer: string
  onAnswerChange: (val: string) => void
  submitting: boolean
  feedback?: { isCorrect: boolean; feedback: string; stillHasError: boolean }
  onSubmit: () => void
}) {
  const isSubmitted = !!feedback

  return (
    <div className={`bg-white rounded-xl border p-4 transition-colors
      ${feedback ? (feedback.isCorrect ? 'border-green-200' : 'border-red-200') : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-white bg-blue-500 w-5 h-5 rounded-full flex items-center justify-center">
          {index}
        </span>
        <span className="text-xs text-slate-500">{vq.trapDescription}</span>
      </div>

      <p className="text-sm text-slate-800 mb-3">{vq.questionText}</p>

      {/* 选择题选项 */}
      {vq.questionType === 'choice' && vq.options && (
        <div className="space-y-2 mb-3">
          {vq.options.map((opt) => (
            <button
              key={opt}
              disabled={isSubmitted}
              onClick={() => onAnswerChange(opt.charAt(0))}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors
                ${answer === opt.charAt(0) && !isSubmitted ? 'border-blue-400 bg-blue-50 text-blue-800' : ''}
                ${isSubmitted && opt.charAt(0) === vq.correctAnswer ? 'border-green-400 bg-green-50 text-green-800' : ''}
                ${isSubmitted && answer === opt.charAt(0) && opt.charAt(0) !== vq.correctAnswer ? 'border-red-300 bg-red-50 text-red-700' : ''}
                ${!isSubmitted && answer !== opt.charAt(0) ? 'border-slate-200 hover:border-slate-300' : ''}
              `}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* 填空/简答/计算 */}
      {vq.questionType !== 'choice' && (
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={isSubmitted}
          placeholder="写下你的答案..."
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 resize-none
            disabled:bg-slate-50 disabled:text-slate-600"
        />
      )}

      {/* 反馈 */}
      {feedback && (
        <div className={`rounded-lg p-3 mb-3 ${feedback.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{feedback.isCorrect ? '✓' : '✗'}</span>
            <span className={`text-xs font-medium ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {feedback.isCorrect ? '答对了！' : '还差一点'}
            </span>
          </div>
          <p className={`text-sm ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{feedback.feedback}</p>
          {!feedback.isCorrect && (
            <p className="text-xs text-slate-500 mt-2">正确答案：{vq.correctAnswer}</p>
          )}
        </div>
      )}

      {!isSubmitted && (
        <button
          onClick={onSubmit}
          disabled={!answer.trim() || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400
            text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              判断中...
            </span>
          ) : '提交答案'}
        </button>
      )}
    </div>
  )
}

// ---- 工具组件 ----
function StatCard({ label, value, color }: { label: string; value: string | number; color: 'slate' | 'red' | 'green' }) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className={`rounded-xl border p-3 text-center ${colorMap[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  )
}

function MasteryBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    not_started: { label: '未开始', className: 'text-slate-500 bg-slate-100' },
    learning: { label: '学习中', className: 'text-blue-600 bg-blue-50' },
    mastered: { label: '已掌握', className: 'text-green-600 bg-green-50' },
    needs_review: { label: '需复习', className: 'text-orange-600 bg-orange-50' },
  }
  const info = map[status] || map.not_started
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${info.className}`}>{info.label}</span>
  )
}

function errorTypeColor(type: string): string {
  const map: Record<string, string> = {
    careless: 'text-yellow-700 bg-yellow-50',
    concept_confusion: 'text-purple-700 bg-purple-50',
    knowledge_gap: 'text-red-700 bg-red-50',
    misreading: 'text-orange-700 bg-orange-50',
    method_unclear: 'text-blue-700 bg-blue-50',
  }
  return map[type] || 'text-slate-700 bg-slate-100'
}
