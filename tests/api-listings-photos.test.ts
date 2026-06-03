import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resetDb, signupAgent } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'
import { POST as uploadPhoto } from '@/app/api/listings/[id]/photos/route'
import { DELETE as deletePhoto } from '@/app/api/listings/[id]/photos/[pid]/route'

let baseDir: string
beforeEach(async () => {
  await resetDb()
  baseDir = await mkdtemp(path.join(tmpdir(), 'le-photos-'))
  process.env.UPLOADS_BASE_DIR = baseDir
})
afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true }).catch(() => {})
})

async function createOne(cookie: string): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'L', dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
    }),
  }))
  return (await r.json()).id
}

function photoFormData(filename: string, caption?: string): FormData {
  const fd = new FormData()
  const blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10])], { type: 'image/png' })  // PNG magic bytes
  fd.append('file', blob, filename)
  if (caption) fd.append('caption', caption)
  return fd
}

describe('POST /api/listings/[id]/photos', () => {
  it('정상 업로드 → 200 + ListingPhoto row', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const fd = photoFormData('living.png', '거실')
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: fd,
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.url).toMatch(/^\/uploads\/listings\/\d+\/photos\/.+\.png$/)
    expect(body.caption).toBe('거실')
    const rows = await prisma.listingPhoto.findMany({ where: { listingId: id } })
    expect(rows).toHaveLength(1)
  })

  it('5MB 초과 → 413', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const big = new Uint8Array(6 * 1024 * 1024)
    const fd = new FormData()
    fd.append('file', new Blob([big], { type: 'image/png' }), 'big.png')
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: fd,
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(413)
  })

  it('허용 안 되는 mime → 415', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'application/pdf' }), 'a.pdf')
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: fd,
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(415)
  })

  it('타사무소 매물 → 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie: B.cookie }, body: photoFormData('a.png'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(404)
  })
})

describe('DELETE /api/listings/[id]/photos/[pid]', () => {
  it('정상 삭제 → 200 + row 사라짐', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const up = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: photoFormData('a.png'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    const upBody = await up.json()
    const pid = upBody.id

    const r = await deletePhoto(
      new Request(`http://localhost/api/listings/${id}/photos/${pid}`, {
        method: 'DELETE', headers: { cookie },
      }),
      { params: Promise.resolve({ id: String(id), pid: String(pid) }) },
    )
    expect(r.status).toBe(200)
    const remaining = await prisma.listingPhoto.findMany({ where: { listingId: id } })
    expect(remaining).toHaveLength(0)
  })
})
