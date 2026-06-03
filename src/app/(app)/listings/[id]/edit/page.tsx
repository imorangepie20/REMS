'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building, ArrowLeft } from 'lucide-react'
import ListingForm, { emptyForm, type ListingFormValue } from '@/components/listings/ListingForm'
import { getListing, updateListing } from '@/lib/api/listings'

function detailToForm(d: Awaited<ReturnType<typeof getListing>>): ListingFormValue {
  return {
    title: d.title,
    complexName: d.complexName ?? '',
    dong: d.dong ?? '',
    ho: d.ho ?? '',
    floor: d.floor ?? '',
    direction: d.direction ?? '',
    pyeongType: d.pyeongType ?? '',
    dealType: d.dealType,
    propertyType: d.propertyType,
    salePrice: d.salePrice ?? '',
    deposit: d.deposit ?? '',
    monthlyRent: d.monthlyRent ?? '',
    areaM2: String(d.areaM2),
    supplyAreaM2: d.supplyAreaM2 != null ? String(d.supplyAreaM2) : '',
    address: d.address,
    addressDetail: d.addressDetail ?? '',
    maintenanceFee: d.maintenanceFee != null ? String(d.maintenanceFee) : '',
    ownerName: d.ownerName ?? '',
    ownerPhone: d.ownerPhone ?? '',
    ownerMemo: d.ownerMemo ?? '',
    commissionRate: d.commissionRate != null ? String(d.commissionRate) : '',
    description: d.description ?? '',
    privateMemo: d.privateMemo ?? '',
    status: d.status,
  }
}

export default function EditListingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)
  const [form, setForm] = useState<ListingFormValue | null>(null)

  useEffect(() => {
    getListing(id).then((d) => setForm(detailToForm(d))).catch(() => setForm(emptyForm))
  }, [id])

  if (!form) return <p className="p-12 text-hud-text-muted">불러오는 중...</p>

  const onSubmit = async (payload: Record<string, unknown>) => {
    await updateListing(id, payload)
    router.replace(`/listings/${id}`)
  }

  return (
    <div className="p-6 text-hud-text-primary max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/listings/${id}`} className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">매물 수정</h1>
      </div>
      <ListingForm initial={form} showStatus submitLabel="저장" onSubmit={onSubmit} />
    </div>
  )
}
