import fs from 'fs'
import path from 'path'
import type { LearningSession } from './types'

const DATA_DIR = path.join(process.cwd(), '.data')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')
const IMAGES_DIR = path.join(DATA_DIR, 'images')

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

function readSessions(): Record<string, LearningSession> {
  ensureDirs()
  if (!fs.existsSync(SESSIONS_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSessions(data: Record<string, LearningSession>) {
  ensureDirs()
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function saveSession(session: LearningSession): void {
  const data = readSessions()
  data[session.id] = session
  writeSessions(data)
}

export function getSession(id: string): LearningSession | null {
  const data = readSessions()
  return data[id] || null
}

export function listSessions(): Array<{
  id: string
  studentName: string
  examName: string
  uploadedAt: string
  wrongQuestions: number
  overallProgress: number
}> {
  const data = readSessions()
  return Object.values(data)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map((s) => ({
      id: s.id,
      studentName: s.studentName,
      examName: s.examName,
      uploadedAt: s.uploadedAt,
      wrongQuestions: s.wrongQuestions,
      overallProgress: s.overallProgress,
    }))
}

export function saveImage(
  id: string,
  _sessionId: string | null,
  _filename: string,
  mimeType: string,
  data: Buffer
): void {
  ensureDirs()
  const ext = mimeType.split('/')[1] || 'jpg'
  const metaPath = path.join(IMAGES_DIR, `${id}.json`)
  const dataPath = path.join(IMAGES_DIR, `${id}.${ext}`)
  fs.writeFileSync(dataPath, data)
  fs.writeFileSync(metaPath, JSON.stringify({ mimeType, ext }), 'utf-8')
}

export function getImage(id: string): { data: Buffer; mimeType: string } | null {
  ensureDirs()
  // 查找meta文件
  const metaPath = path.join(IMAGES_DIR, `${id}.json`)
  if (!fs.existsSync(metaPath)) return null
  try {
    const { mimeType, ext } = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    const dataPath = path.join(IMAGES_DIR, `${id}.${ext}`)
    if (!fs.existsSync(dataPath)) return null
    return { data: fs.readFileSync(dataPath), mimeType }
  } catch {
    return null
  }
}
