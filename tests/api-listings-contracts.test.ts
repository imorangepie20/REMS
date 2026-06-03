import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resetDb, signupAgent } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'
import { POST as uploadContract } from '@/app/api/listings/[id]/contracts/route'
import { DELETE as deleteContract } from '@/app/api/listings/[id]/contracts/[cid]/route'

let baseDir: string
beforeEach(async () => {
  await resetDb()
  baseDir = await mkdtemp(path.join(tmpdir(), 'le-contracts-'))
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

function contractForm(filename: string, mime: string, bytes = 100): FormData {
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), filename)
  return fd
}

describe('POST /api/listings/[id]/contracts', () => {
  it('PDF 업로드 → 200', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('계약서.pdf', 'application/pdf'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.filename).toBe('계약서.pdf')
    expect(body.url).toMatch(/\.pdf$/)
    const rows = await prisma.listingContract.findMany({ where: { listingId: id } })
    expect(rows).toHaveLength(1)
  })

  it('10MB 초과 → 413', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('big.pdf', 'application/pdf', 11 * 1024 * 1024),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(413)
  })

  it('exe 같은 위험한 mime → 415', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('mal.exe', 'application/x-msdownload'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(415)
  })
})

describe('DELETE /api/listings/[id]/contracts/[cid]', () => {
  it('정상 삭제', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const up = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('a.pdf', 'application/pdf'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    const cid = (await up.json()).id

    const r = await deleteContract(
      new Request(`http://localhost/api/listings/${id}/contracts/${cid}`, {
        method: 'DELETE', headers: { cookie },
      }),
      { params: Promise.resolve({ id: String(id), cid: String(cid) }) },
    )
    expect(r.status).toBe(200)
    const remaining = await prisma.listingContract.findMany({ where: { listingId: id } })
    expect(remaining).toHaveLength(0)
  })
})
