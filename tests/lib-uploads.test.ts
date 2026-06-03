import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveUpload, deleteUpload } from '@/lib/uploads'

let tmp: string
beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'le-uploads-'))
})
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('saveUpload', () => {
  it('파일 저장 + 안전한 파일명 + URL 반환', async () => {
    const buf = Buffer.from('hello world')
    const res = await saveUpload({
      baseDir: tmp,
      relativeDir: 'listings/123/photos',
      filename: 'photo.jpg',
      data: buf,
    })
    expect(res.url).toMatch(/^\/uploads\/listings\/123\/photos\/[a-f0-9]+\.jpg$/)
    expect(res.absolutePath.startsWith(tmp)).toBe(true)
    const written = await readFile(res.absolutePath)
    expect(written.equals(buf)).toBe(true)
  })

  it('확장자 보존', async () => {
    const r1 = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'x.PDF', data: Buffer.from('x') })
    expect(r1.url.endsWith('.pdf')).toBe(true)
    const r2 = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'x.webp', data: Buffer.from('x') })
    expect(r2.url.endsWith('.webp')).toBe(true)
  })

  it('확장자 없으면 .bin', async () => {
    const r = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'noext', data: Buffer.from('x') })
    expect(r.url.endsWith('.bin')).toBe(true)
  })
})

describe('deleteUpload', () => {
  it('URL로 파일 삭제', async () => {
    const saved = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'x.txt', data: Buffer.from('x') })
    await deleteUpload(tmp, saved.url)
    await expect(readFile(saved.absolutePath)).rejects.toThrow()
  })

  it('없는 파일은 조용히 무시', async () => {
    await expect(deleteUpload(tmp, '/uploads/a/nonexistent.txt')).resolves.toBeUndefined()
  })
})
