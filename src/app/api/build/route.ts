import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { createListingDesign, uploadImageToCanva } from '@/lib/canva'
import { Agent, Listing } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { listing_id } = await req.json()
    if (!listing_id) return NextResponse.json({ error: 'listing_id required' }, { status: 400 })

    const { data: rows } = await db.from('listings').select('*').eq('id', listing_id).get()
    const listing = (rows as Listing[])[0]
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const { data: agentRows } = await db.from('agents').select('*').eq('name', listing.agent_name).get()
    const agent = (agentRows as Agent[])[0]
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    // If listing has an external photo URL, upload it to Canva first
    let photoAssetId = listing.photo_url
    if (listing.photo_url && !listing.photo_url.startsWith('canva:')) {
      try {
        photoAssetId = await uploadImageToCanva(listing.photo_url)
      } catch {
        // proceed without photo
        photoAssetId = null
      }
    }

    const listingWithAsset = { ...listing, photo_url: photoAssetId }
    const { design_id, export_url } = await createListingDesign(listingWithAsset, agent)

    await db.from('listings').eq('id', listing_id).update({
      build_status: 'built',
      canva_design_id: design_id,
      canva_export_url: export_url,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, design_id, export_url })
  } catch (err) {
    console.error('Build error:', err)
    // Mark as error
    const body = await (req.clone().json().catch(() => ({}))) as { listing_id?: string }
    if (body.listing_id) {
      await db.from('listings').eq('id', body.listing_id).update({
        build_status: 'error',
        updated_at: new Date().toISOString(),
      }).catch(() => {})
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
