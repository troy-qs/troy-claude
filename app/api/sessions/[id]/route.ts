import { NextRequest, NextResponse } from 'next/server'
import { getSession, saveSession } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = getSession(id)
    if (!session) {
      return NextResponse.json({ error: '找不到该学习记录' }, { status: 404 })
    }
    return NextResponse.json({ session })
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = getSession(id)
    if (!session) {
      return NextResponse.json({ error: '找不到该学习记录' }, { status: 404 })
    }

    const updates = await req.json()
    const updated = { ...session, ...updates }
    saveSession(updated)

    return NextResponse.json({ session: updated })
  } catch (error) {
    console.error('Update session error:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}
