import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '化学中考错题诊断 | 大连高新一中',
  description: '上传化学试卷，AI分析错误原因，针对性补习，直到真正掌握',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}
