import { NextRequest, NextResponse } from 'next/server'
import { getImage } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const image = getImage(id)
    if (!image) {
      return NextResponse.json({ error: '找不到图片' }, { status: 404 })
    }
    return new NextResponse(image.data as unknown as BodyInit, {
      headers: { 'Content-Type': image.mimeType },
    })
  } catch (error) {
    console.error('Get image error:', error)
    return NextResponse.json({ error: '获取图片失败' }, { status: 500 })
  }
}
