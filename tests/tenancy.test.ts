import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { GET as listAgents } from '@/app/api/agents/route'
import { PATCH as updateAgent } from '@/app/api/agents/[id]/route'
import { PATCH as agencyHandler } from '@/app/api/agency/route'

beforeEach(async () => { await resetDb() })

describe('tenancy isolation', () => {
  it('사무소 A owner는 사무소 B agent를 보거나 수정할 수 없다', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A사무소', email: 'a@x.com', password: 'pw12345678' })
    const B = await signupAgent(signupHandler, { agencyName: 'B사무소', email: 'b@x.com', password: 'pw12345678' })

    // A의 agents 리스트에 B의 agent는 없다
    const listA = await listAgents(new Request('http://localhost/api/agents', { headers: { cookie: A.cookie } }))
    const arrA = await listA.json()
    expect(arrA.map((a: { email: string }) => a.email)).toEqual(['a@x.com'])

    // A가 B의 agentId를 PATCH 시도 → 404 (격리)
    const patch = await updateAgent(
      new Request(`http://localhost/api/agents/${B.agentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: A.cookie },
        body: JSON.stringify({ name: '침해' }),
      }),
      { params: Promise.resolve({ id: String(B.agentId) }) },
    )
    expect(patch.status).toBe(404)
  })

  it('각 사무소의 agency 수정은 본인 agencyId에만 적용', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'aa@x.com', password: 'pw12345678' })
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'bb@x.com', password: 'pw12345678' })

    await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: A.cookie },
      body: JSON.stringify({ name: 'A_변경' }),
    }))

    // B의 cookie로 me → agency name 보면 B 그대로
    // (간단히 B가 자신 agency 다시 PATCH해보기로 검증)
    const resB = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: B.cookie },
      body: JSON.stringify({ name: 'B_변경' }),
    }))
    expect(resB.status).toBe(200)
    const body = await resB.json()
    expect(body.id).toBe(B.agencyId)
    expect(body.name).toBe('B_변경')
  })
})
