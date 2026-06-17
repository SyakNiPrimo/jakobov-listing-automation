'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Listing, ListingPhoto, PHOTO_SLOTS, PHOTO_SLOT_LABELS, PhotoSlot } from '@/types'
import Image from 'next/image'

const STATUS_COLORS: Record<string, string> = {
  'New Listing': '#C9A96E',
  'Pending': '#7B5EA7',
  'Coming Soon': '#4A7B9D',
  'Closed': '#3D7A5C',
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [photos, setPhotos] = useState<ListingPhoto[]>([])
  const [caption, setCaption] = useState('')
  const [captionEdited, setCaptionEdited] = useState(false)
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [building, setBuilding] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlot | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(async () => {
    const [lRes, pRes] = await Promise.all([
      fetch(`/api/listings/${id}`),
      fetch(`/api/listings/${id}/photos`),
    ])
    if (lRes.ok) {
      const l: Listing = await lRes.json()
      setListing(l)
      if (l.generated_caption && !captionEdited) setCaption(l.generated_caption)
    }
    if (pRes.ok) setPhotos(await pRes.json())
  }, [id, captionEdited])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenerateCaption = async () => {
    setGeneratingCaption(true)
    const res = await fetch(`/api/listings/${id}/generate-caption`, { method: 'POST' })
    const data = await res.json()
    setGeneratingCaption(false)
    if (res.ok) {
      setCaption(data.caption)
      setCaptionEdited(false)
      showToast('Caption generated')
    } else {
      showToast(`Caption generation failed: ${data.error}`, false)
    }
  }

  const handleBuild = async () => {
    setBuilding(true)
    const res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: id }),
    })
    const data = await res.json()
    setBuilding(false)
    if (res.ok) {
      showToast('Design built successfully')
      fetchData()
    } else {
      showToast(`Build failed: ${data.error}`, false)
    }
  }

  const handleMarkPosted = async () => {
    const res = await fetch(`/api/listings/${id}/mark-posted`, { method: 'POST' })
    if (res.ok) { showToast('Marked as posted'); fetchData() }
  }

  const handlePhotoUpload = async (slot: PhotoSlot, file: File) => {
    setUploadingSlot(slot)
    const form = new FormData()
    form.append('slot', slot)
    form.append('file', file)
    const res = await fetch(`/api/listings/${id}/photos`, { method: 'POST', body: form })
    const data = await res.json()
    setUploadingSlot(null)
    if (res.ok) {
      showToast(`${PHOTO_SLOT_LABELS[slot]} uploaded and processed`)
      fetchData()
    } else {
      showToast(`Upload failed: ${data.error}`, false)
    }
  }

  const photoBySlot = (slot: PhotoSlot) => photos.find(p => p.slot === slot)

  if (!listing) {
    return <div className="py-20 text-center" style={{ color: 'var(--gray)' }}>Loading…</div>
  }

  const inputStyle = {
    background: 'rgba(28,28,46,0.8)',
    border: '1px solid rgba(201,169,110,0.25)',
    color: 'var(--cream)',
    borderRadius: '6px',
    padding: '8px 12px',
    width: '100%',
    fontSize: '14px',
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded text-sm font-medium shadow-lg" style={{ background: toast.ok ? '#3D7A5C' : '#A04040', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/')} className="text-xs mb-3 flex items-center gap-1" style={{ color: 'var(--gray)' }}>
            ← Back to Dashboard
          </button>
          <h1 className="font-headline text-3xl" style={{ color: 'var(--gold)' }}>{listing.address}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--gray)' }}>{listing.city}, {listing.state} {listing.zip}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: `${STATUS_COLORS[listing.status]}22`, color: STATUS_COLORS[listing.status] }}>
              {listing.status}
            </span>
            {listing.is_luxury && (
              <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: 'rgba(201,169,110,0.2)', color: 'var(--gold)' }}>LUXURY</span>
            )}
            <span className="text-sm capitalize" style={{ color: 'var(--gray)' }}>{listing.deal_side} side</span>
          </div>
        </div>
        <div className="flex gap-3">
          {(listing.build_status === 'ready' || listing.build_status === 'error') && (
            <button onClick={handleBuild} disabled={building} className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ background: 'var(--purple)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}>
              {building ? 'Building…' : 'Build Canva Design'}
            </button>
          )}
          {listing.build_status === 'built' && (
            <button onClick={handleMarkPosted} className="px-4 py-2 rounded text-sm font-medium" style={{ background: '#3D7A5C22', color: '#3D7A5C', border: '1px solid #3D7A5C44' }}>
              Mark as Posted
            </button>
          )}
          {listing.canva_export_url && (
            <a href={listing.canva_export_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded text-sm font-medium" style={{ background: 'rgba(201,169,110,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}>
              View Design
            </a>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        {[
          { label: 'Agent', value: listing.agent_name },
          { label: 'Price', value: listing.price ? `$${listing.price.toLocaleString()}` : '—' },
          { label: 'MLS #', value: listing.mls_number ? `#${listing.mls_number}` : 'Manual entry' },
          { label: 'Bedrooms', value: listing.bedrooms ?? '—' },
          { label: 'Bathrooms', value: listing.bathrooms ?? '—' },
          { label: 'Size', value: listing.sqft_or_acreage || '—' },
          { label: 'Source', value: listing.source },
          { label: 'Build Status', value: listing.build_status },
          { label: 'Received', value: listing.email_received_at ? new Date(listing.email_received_at).toLocaleDateString() : '—' },
        ].map(item => (
          <div key={item.label} className="px-4 py-3 rounded" style={{ background: 'rgba(46,26,71,0.4)', border: '1px solid rgba(201,169,110,0.1)' }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--gray)' }}>{item.label}</div>
            <div style={{ color: 'var(--cream)' }}>{String(item.value)}</div>
          </div>
        ))}
      </div>

      {/* Caption Generator */}
      <div className="rounded-lg p-5 space-y-4" style={{ background: 'rgba(46,26,71,0.4)', border: '1px solid rgba(201,169,110,0.15)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-xl" style={{ color: 'var(--gold)' }}>Instagram Caption</h2>
          <button
            onClick={handleGenerateCaption}
            disabled={generatingCaption}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--purple)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}
          >
            {generatingCaption ? 'Generating…' : caption ? 'Regenerate' : 'Generate Caption'}
          </button>
        </div>
        {caption && (
          <textarea
            value={caption}
            onChange={e => { setCaption(e.target.value); setCaptionEdited(true) }}
            style={{ ...inputStyle, minHeight: '220px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
          />
        )}
        {!caption && (
          <p className="text-sm" style={{ color: 'var(--gray)' }}>
            Click Generate Caption to create an AI-written Instagram caption from this listing&apos;s details.
          </p>
        )}
      </div>

      {/* Photo Slots */}
      <div className="space-y-4">
        <h2 className="font-headline text-xl" style={{ color: 'var(--gold)' }}>Listing Photos</h2>
        <p className="text-sm" style={{ color: 'var(--gray)' }}>
          Upload a source photo for each slot. Each photo will be processed with a blur-fill treatment for Instagram.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {PHOTO_SLOTS.map(slot => {
            const photo = photoBySlot(slot)
            const isUploading = uploadingSlot === slot
            return (
              <div key={slot} className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(201,169,110,0.2)', background: 'rgba(28,28,46,0.6)' }}>
                <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gold)', borderBottom: '1px solid rgba(201,169,110,0.15)' }}>
                  {PHOTO_SLOT_LABELS[slot]}
                </div>
                {photo?.processed_url ? (
                  <div className="space-y-2 p-2">
                    <div className="text-xs" style={{ color: 'var(--gray)' }}>Processed</div>
                    <Image src={photo.processed_url} alt={PHOTO_SLOT_LABELS[slot]} width={300} height={300} className="w-full rounded object-cover aspect-square" />
                    {photo.original_url && (
                      <a href={photo.original_url} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--gray)' }}>View original</a>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center" style={{ color: 'var(--gray)' }}>
                    <div className="text-2xl mb-2">📷</div>
                    <div className="text-xs mb-3">No photo yet</div>
                  </div>
                )}
                <div className="p-2">
                  <label className="block w-full cursor-pointer">
                    <span
                      className="block text-center px-3 py-1.5 rounded text-xs font-medium w-full"
                      style={{ background: isUploading ? 'rgba(201,169,110,0.1)' : 'rgba(201,169,110,0.2)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}
                    >
                      {isUploading ? 'Processing…' : photo ? 'Replace' : 'Upload Photo'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handlePhotoUpload(slot, file)
                      }}
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
