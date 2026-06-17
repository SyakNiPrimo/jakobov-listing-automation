import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { applyBlurFill } from '@/lib/photo'
import { PhotoSlot, PHOTO_SLOTS } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData()
    const slot = formData.get('slot') as PhotoSlot
    const file = formData.get('file') as File | null

    if (!slot || !PHOTO_SLOTS.includes(slot)) {
      return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
    }

    let originalUrl: string
    let processedBuffer: Buffer

    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const inputBuffer = Buffer.from(arrayBuffer)
      processedBuffer = await applyBlurFill(inputBuffer)

      // Store via InsForge storage (presigned upload)
      const uploadRes = await fetch(`${process.env.INSFORGE_API_URL}/storage/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`,
          'Content-Type': 'image/jpeg',
          'X-File-Name': `${params.id}/${slot}/original.jpg`,
        },
        body: inputBuffer as unknown as BodyInit,
      })
      const uploadData = await uploadRes.json()
      originalUrl = uploadData.url || ''
    } else {
      const url = formData.get('url') as string
      if (!url) return NextResponse.json({ error: 'file or url required' }, { status: 400 })
      originalUrl = url
      const res = await fetch(url)
      const buf = Buffer.from(await res.arrayBuffer())
      processedBuffer = await applyBlurFill(buf)
    }

    // Upload processed image
    const processedRes = await fetch(`${process.env.INSFORGE_API_URL}/storage/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`,
        'Content-Type': 'image/jpeg',
        'X-File-Name': `${params.id}/${slot}/processed.jpg`,
      },
      body: processedBuffer as unknown as BodyInit,
    })
    const processedData = await processedRes.json()
    const processedUrl = processedData.url || ''

    // Upsert listing_photos row
    const { data: existing } = await db
      .from('listing_photos')
      .select('id')
      .eq('listing_id', params.id)
      .eq('slot', slot)
      .get()

    const existingRow = (existing as { id: string }[])[0]

    if (existingRow) {
      await db.from('listing_photos').eq('id', existingRow.id).update({
        original_url: originalUrl,
        processed_url: processedUrl,
      })
    } else {
      await db.from('listing_photos').insert({
        id: uuidv4(),
        listing_id: params.id,
        slot,
        original_url: originalUrl,
        processed_url: processedUrl,
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true, original_url: originalUrl, processed_url: processedUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await db
      .from('listing_photos')
      .select('*')
      .eq('listing_id', params.id)
      .get()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
