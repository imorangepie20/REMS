'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { ListingPhoto } from '@/lib/api/listings'

interface Props {
  photos: ListingPhoto[]
  canEdit: boolean
  onDelete?: (photoId: number) => Promise<void>
}

export function PhotoGallery({ photos, canEdit, onDelete }: Props) {
  const [zoom, setZoom] = useState<ListingPhoto | null>(null)
  if (photos.length === 0) return <p className="text-sm text-hud-text-muted">사진 없음</p>
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="hud-card rounded-lg overflow-hidden aspect-[4/3] relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption ?? ''}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setZoom(p)}
            />
            {p.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                {p.caption}
              </div>
            )}
            {canEdit && onDelete && (
              <button
                onClick={() => { if (confirm('이 사진을 삭제할까요?')) onDelete(p.id) }}
                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="사진 삭제"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setZoom(null)}>
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.url} alt={zoom.caption ?? ''} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
