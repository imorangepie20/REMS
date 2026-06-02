import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

export const UPLOADS_ROOT = path.join(process.cwd(), 'public')
const PUBLIC_URL_PREFIX = '/uploads'

export interface SaveUploadInput {
  baseDir: string
  relativeDir: string  // 예: 'listings/123/photos'
  filename: string     // 원본 파일명 (확장자 추출용)
  data: Buffer | Uint8Array
}

export interface SaveUploadResult {
  url: string          // public URL (e.g. '/uploads/listings/123/photos/abc.jpg')
  absolutePath: string // 실제 파일 시스템 경로
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx < 0 || idx === filename.length - 1) return '.bin'
  return '.' + filename.slice(idx + 1).toLowerCase()
}

export async function saveUpload(input: SaveUploadInput): Promise<SaveUploadResult> {
  const safeRel = input.relativeDir.replace(/\.\.|^\/+/g, '')
  const dirAbs = path.join(input.baseDir, 'uploads', safeRel)
  await mkdir(dirAbs, { recursive: true })
  const random = randomBytes(16).toString('hex')
  const ext = extOf(input.filename)
  const finalName = `${random}${ext}`
  const absolutePath = path.join(dirAbs, finalName)
  await writeFile(absolutePath, input.data)
  const url = `${PUBLIC_URL_PREFIX}/${safeRel}/${finalName}`
  return { url, absolutePath }
}

export async function deleteUpload(baseDir: string, url: string): Promise<void> {
  if (!url.startsWith(PUBLIC_URL_PREFIX + '/')) return
  const rel = url.slice(PUBLIC_URL_PREFIX.length + 1)  // 'listings/123/photos/abc.jpg'
  if (rel.includes('..')) return
  const absolutePath = path.join(baseDir, 'uploads', rel)
  try {
    await unlink(absolutePath)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}
