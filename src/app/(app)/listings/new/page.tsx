'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building, ArrowLeft } from 'lucide-react'
import ListingForm, { emptyForm } from '@/components/listings/ListingForm'
import { createListing } from '@/lib/api/listings'

export default function NewListingPage() {
  const router = useRouter()

  const onSubmit = async (payload: Record<string, unknown>) => {
    const created = await createListing(payload)
    router.replace(`/listings/${created.id}`)
  }

  return (
    <div className="p-6 text-hud-text-primary max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/listings" className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">매물 등록</h1>
      </div>
      <ListingForm initial={emptyForm} submitLabel="등록" onSubmit={onSubmit} />
    </div>
  )
}
