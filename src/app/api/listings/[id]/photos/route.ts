import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { applyBlurFill } from '@/lib/photo'
import { PhotoSlot, PHOTO_SLOTS } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const BASE_URL = process.env.INSFORGE_API_URL!
const API_KEY = process.env.INSFORGE_API_KEY!
const BUCKET = 'listing-photos'

async function uploadToInsforge(buffer: Buffer, objectKey: string): Promise<string> {
  const form = new FormData()
  const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' })
  form.append('file', new File([blob], objectKey.split('/').pop() || 'photo.jpg', { type: 'image/jpeg' }))

  const res = await fetch(`${BASE_URL}/api/storage/buckets/${BUCKET}/objects/${encodeURIComponent(objectKey)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Storage upload failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  // Return absolute URL
  const url: string = data.url || ''
  return url.startsWith('http') ? url : `${BASE_URL}${url}`
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData()
    const slot = formData.get('slot') as PhotoSlot
    const file = formData.get('file') as File | null

    if (!slot || !PHOTO_SLOTS.includes(slot)) {
      return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
    }

    let originalBuffer: Buffer

    if (file) {
      originalBuffer = Buffer.from(await file.arrayBuffer())
    } else {
      const url = formData.get('url') as string
      if (!url) return NextResponse.json({ error: 'file or url required' }, { status: 400 })
      const res = await fetch(url)
      originalBuffer = Buffer.from(await res.arrayBuffer())
    }

    const processedBuffer = await applyBlurFill(originalBuffer)

    const originalUrl = await uploadToInsforge(originalBuffer, `${params.id}/${slot}/original.jpg`)
    const processedUrl = await uploadToInsforge(processedBuffer, `${params.id}/${slot}/processed.jpg`)

    // Upsert listing_photos row
    const { data: existing } = await db.database
      .from('listing_photos')
      .select('id')
      .eq('listing_id', params.id)
      .eq('slot', slot)
      .maybeSingle()

    if (existing) {
      await db.database.from('listing_photos').update({
        original_url: originalUrl,
        processed_url: processedUrl,
      }).eq('id', (existing as { id: string }).id)
    } else {
      await db.database.from('listing_photos').insert([{
        id: uuidv4(),
        listing_id: params.id,
        slot,
        original_url: originalUrl,
        processed_url: processedUrl,
      }])
    }

    return NextResponse.json({ ok: true, original_url: originalUrl, processed_url: processedUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await db.database.from('listing_photos').select('*').eq('listing_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
