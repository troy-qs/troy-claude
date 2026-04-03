import { NextResponse } from 'next/server'
import { listSessions } from '@/lib/db'

export async function GET() {
  try {
    const sessions = listSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('List sessions error:', error)
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
  }
}
