'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [studentName, setStudentName] = useState('')
  const [examName, setExamName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f: File) => {
    setFile(f)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file) { setError('请先选择试卷图片'); return }
    if (!studentName.trim()) { setError('请输入姓名'); return }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('studentName', studentName.trim())
      formData.append('examName', examName.trim() || '化学试卷')

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || '上传失败')

      router.push(`/session/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">化</div>
          <div>
            <h1 className="font-semibold text-slate-900 leading-none">化学错题诊断</h1>
            <p className="text-xs text-slate-500 mt-0.5">大连高新一中 · 初三化学 · 中考备考</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {/* 说明卡片 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800 font-medium mb-1">怎么用？</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>拍一张化学试卷的清晰照片（要能看到答案和批改）</li>
              <li>AI自动识别每道题和你写的答案</li>
              <li>针对每道错题，分析你为什么错，不是泛泛讲知识点</li>
              <li>出2道同类型的验证题，确认你真的懂了</li>
            </ol>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            {/* 姓名 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">你的名字</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="输入名字"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 试卷名称 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                试卷名称 <span className="text-slate-400 font-normal">（选填）</span>
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="如：3月月考、第二次模拟"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 上传区域 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">上传试卷照片</label>
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
                  ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={onFileChange}
                  className="hidden"
                />

                {preview ? (
                  <div className="p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="试卷预览"
                      className="w-full rounded-lg object-contain max-h-64"
                    />
                    <p className="text-center text-xs text-slate-500 mt-2">{file?.name} · 点击重新选择</p>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="text-4xl mb-3">📄</div>
                    <p className="text-sm font-medium text-slate-600">点击或拖拽上传试卷图片</p>
                    <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG、WebP，最大 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={uploading || !file}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400
                text-white font-medium py-3 rounded-xl transition-colors text-sm"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI正在识别试卷，请稍候...
                </span>
              ) : '开始分析'}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            图片只用于本次分析，不会存储到外部服务器
          </p>
        </div>
      </div>
    </main>
  )
}
