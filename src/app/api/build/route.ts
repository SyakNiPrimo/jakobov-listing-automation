import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { createListingDesign, uploadImageToCanva } from '@/lib/canva'
import { Agent, Listing } from '@/types'

export async function POST(req: NextRequest) {
  let listing_id: string | undefined
  try {
    const body = await req.json()
    listing_id = body.listing_id
    if (!listing_id) return NextResponse.json({ error: 'listing_id required' }, { status: 400 })

    const { data: rows } = await db.database.from('listings').select('*').eq('id', listing_id)
    const listing = ((rows ?? []) as Listing[])[0]
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const { data: agentRows } = await db.database.from('agents').select('*').eq('name', listing.agent_name)
    const agent = ((agentRows ?? []) as Agent[])[0]
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    let photoAssetId = listing.photo_url
    if (listing.photo_url && !listing.photo_url.startsWith('canva:')) {
      try { photoAssetId = await uploadImageToCanva(listing.photo_url) } catch { photoAssetId = null }
    }

    const { design_id, export_url } = await createListingDesign({ ...listing, photo_url: photoAssetId }, agent)

    await db.database.from('listings').update({
      build_status: 'built',
      canva_design_id: design_id,
      canva_export_url: export_url,
    }).eq('id', listing_id)

    return NextResponse.json({ ok: true, design_id, export_url })
  } catch (err) {
    console.error('Build error:', err)
    if (listing_id) {
      await db.database.from('listings').update({ build_status: 'error' }).eq('id', listing_id)
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
