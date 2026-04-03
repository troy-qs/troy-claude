import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { LearningSession } from './types'

const DB_DIR = path.join(process.cwd(), '.data')
const DB_PATH = path.join(DB_DIR, 'zhongkao.db')

function getDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  return db
}

function initDb() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      exam_name TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data BLOB NOT NULL,
      uploaded_at TEXT NOT NULL
    );
  `)
  db.close()
}

initDb()

export function saveSession(session: LearningSession): void {
  const db = getDb()
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (id, student_name, exam_name, uploaded_at, data)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(
      session.id,
      session.studentName,
      session.examName,
      session.uploadedAt,
      JSON.stringify(session)
    )
  } finally {
    db.close()
  }
}

export function getSession(id: string): LearningSession | null {
  const db = getDb()
  try {
    const stmt = db.prepare('SELECT data FROM sessions WHERE id = ?')
    const row = stmt.get(id) as { data: string } | undefined
    return row ? JSON.parse(row.data) : null
  } finally {
    db.close()
  }
}

export function listSessions(): Array<{
  id: string
  studentName: string
  examName: string
  uploadedAt: string
  wrongQuestions: number
  overallProgress: number
}> {
  const db = getDb()
  try {
    const stmt = db.prepare('SELECT data FROM sessions ORDER BY uploaded_at DESC')
    const rows = stmt.all() as { data: string }[]
    return rows.map((row) => {
      const s: LearningSession = JSON.parse(row.data)
      return {
        id: s.id,
        studentName: s.studentName,
        examName: s.examName,
        uploadedAt: s.uploadedAt,
        wrongQuestions: s.wrongQuestions,
        overallProgress: s.overallProgress,
      }
    })
  } finally {
    db.close()
  }
}

export function saveImage(
  id: string,
  sessionId: string | null,
  filename: string,
  mimeType: string,
  data: Buffer
): void {
  const db = getDb()
  try {
    const stmt = db.prepare(`
      INSERT INTO images (id, session_id, filename, mime_type, data, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, sessionId, filename, mimeType, data, new Date().toISOString())
  } finally {
    db.close()
  }
}

export function getImage(id: string): { data: Buffer; mimeType: string } | null {
  const db = getDb()
  try {
    const stmt = db.prepare('SELECT data, mime_type FROM images WHERE id = ?')
    const row = stmt.get(id) as { data: Buffer; mime_type: string } | undefined
    return row ? { data: row.data, mimeType: row.mime_type } : null
  } finally {
    db.close()
  }
}
