'use client'

import { useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'

export interface ListingFormValue {
  title: string
  complexName: string
  dong: string
  ho: string
  floor: string
  direction: string
  pyeongType: string
  dealType: 'sale' | 'jeonse' | 'wolse'
  propertyType: 'apartment' | 'officetel' | 'villa' | 'house' | 'commercial' | 'land'
  salePrice: string
  deposit: string
  monthlyRent: string
  areaM2: string
  supplyAreaM2: string
  address: string
  addressDetail: string
  maintenanceFee: string
  ownerName: string
  ownerPhone: string
  ownerMemo: string
  commissionRate: string
  description: string
  privateMemo: string
  status: 'active' | 'contracted' | 'hidden'
}

export const emptyForm: ListingFormValue = {
  title: '', complexName: '', dong: '', ho: '', floor: '', direction: '', pyeongType: '',
  dealType: 'sale', propertyType: 'apartment',
  salePrice: '', deposit: '', monthlyRent: '',
  areaM2: '', supplyAreaM2: '',
  address: '', addressDetail: '',
  maintenanceFee: '', ownerName: '', ownerPhone: '', ownerMemo: '',
  commissionRate: '', description: '', privateMemo: '', status: 'active',
}

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

interface Props {
  initial: ListingFormValue
  showStatus?: boolean
  submitLabel: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}

function num(v: string): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function bigStr(v: string): string | undefined {
  if (v.trim() === '') return undefined
  if (!/^\d+$/.test(v.trim())) return undefined
  return v.trim()
}

function toPayload(f: ListingFormValue): Record<string, unknown> {
  return {
    title: f.title,
    complexName: f.complexName || undefined,
    dong: f.dong || undefined,
    ho: f.ho || undefined,
    floor: f.floor || undefined,
    direction: f.direction || undefined,
    pyeongType: f.pyeongType || undefined,
    dealType: f.dealType,
    propertyType: f.propertyType,
    salePrice: bigStr(f.salePrice),
    deposit: bigStr(f.deposit),
    monthlyRent: bigStr(f.monthlyRent),
    areaM2: num(f.areaM2),
    supplyAreaM2: num(f.supplyAreaM2),
    address: f.address,
    addressDetail: f.addressDetail || undefined,
    maintenanceFee: num(f.maintenanceFee),
    ownerName: f.ownerName || undefined,
    ownerPhone: f.ownerPhone || undefined,
    ownerMemo: f.ownerMemo || undefined,
    commissionRate: num(f.commissionRate),
    description: f.description || undefined,
    privateMemo: f.privateMemo || undefined,
    status: f.status,
  }
}

export default function ListingForm({ initial, showStatus = false, submitLabel, onSubmit }: Props) {
  const [form, setForm] = useState<ListingFormValue>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof ListingFormValue, v: string) => setForm((f) => ({ ...f, [k]: v } as ListingFormValue))

  const handle = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await onSubmit(toPayload(form))
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-6">
      <Section title="식별">
        <Field label="제목 *"><input required className={input} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="단지명"><input className={input} value={form.complexName} onChange={(e) => set('complexName', e.target.value)} /></Field>
        <Field label="동"><input className={input} value={form.dong} onChange={(e) => set('dong', e.target.value)} /></Field>
        <Field label="호"><input className={input} value={form.ho} onChange={(e) => set('ho', e.target.value)} /></Field>
        <Field label="층"><input className={input} value={form.floor} onChange={(e) => set('floor', e.target.value)} /></Field>
        <Field label="평형명"><input className={input} value={form.pyeongType} onChange={(e) => set('pyeongType', e.target.value)} placeholder="예: 84A" /></Field>
        <Field label="향">
          <select className={input} value={form.direction} onChange={(e) => set('direction', e.target.value)}>
            <option value="">선택</option>
            <option value="north">북</option><option value="east">동</option>
            <option value="south">남</option><option value="west">서</option>
            <option value="northeast">북동</option><option value="southeast">남동</option>
            <option value="southwest">남서</option><option value="northwest">북서</option>
          </select>
        </Field>
      </Section>

      <Section title="거래">
        <Field label="거래유형 *">
          <select className={input} value={form.dealType} onChange={(e) => set('dealType', e.target.value)}>
            <option value="sale">매매</option><option value="jeonse">전세</option><option value="wolse">월세</option>
          </select>
        </Field>
        <Field label="매물종류 *">
          <select className={input} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
            <option value="apartment">아파트</option><option value="officetel">오피스텔</option>
            <option value="villa">빌라/연립</option><option value="house">단독/다가구</option>
            <option value="commercial">상가</option><option value="land">토지</option>
          </select>
        </Field>
        {form.dealType === 'sale' && (
          <Field label="매매가 (원) *"><input type="number" className={input} value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} /></Field>
        )}
        {(form.dealType === 'jeonse' || form.dealType === 'wolse') && (
          <Field label="보증금 (원) *"><input type="number" className={input} value={form.deposit} onChange={(e) => set('deposit', e.target.value)} /></Field>
        )}
        {form.dealType === 'wolse' && (
          <Field label="월세 (원) *"><input type="number" className={input} value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} /></Field>
        )}
      </Section>

      <Section title="면적">
        <Field label="전용면적 (㎡) *"><input type="number" step="0.01" required className={input} value={form.areaM2} onChange={(e) => set('areaM2', e.target.value)} /></Field>
        <Field label="공급면적 (㎡)"><input type="number" step="0.01" className={input} value={form.supplyAreaM2} onChange={(e) => set('supplyAreaM2', e.target.value)} /></Field>
      </Section>

      <Section title="위치">
        <Field label="주소 *" wide><input required className={input} value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="상세주소" wide><input className={input} value={form.addressDetail} onChange={(e) => set('addressDetail', e.target.value)} /></Field>
      </Section>

      <Section title="메타">
        <Field label="관리비 (월, 원)"><input type="number" className={input} value={form.maintenanceFee} onChange={(e) => set('maintenanceFee', e.target.value)} /></Field>
        <Field label="중개수수료율 (%)"><input type="number" step="0.01" className={input} value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} /></Field>
        <Field label="소유자 이름"><input className={input} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
        <Field label="소유자 전화"><input className={input} value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="010-0000-0000" /></Field>
        <Field label="소유자 메모" wide><textarea className={input} rows={2} value={form.ownerMemo} onChange={(e) => set('ownerMemo', e.target.value)} /></Field>
        <Field label="설명 (공개)" wide><textarea className={input} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="비공개 메모 (작성자·owner만)" wide><textarea className={input} rows={2} value={form.privateMemo} onChange={(e) => set('privateMemo', e.target.value)} /></Field>
      </Section>

      {showStatus && (
        <Section title="상태">
          <Field label="거래 상태">
            <select className={input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">거래중</option>
              <option value="contracted">거래완료</option>
              <option value="hidden">숨김</option>
            </select>
          </Field>
        </Section>
      )}

      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}

      <Button variant="primary" type="submit" disabled={saving} fullWidth glow>
        {saving ? '저장 중...' : submitLabel}
      </Button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud-card rounded-lg p-4">
      <h2 className="text-sm font-semibold text-hud-text-primary mb-3">{title}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-xs text-hud-text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}
