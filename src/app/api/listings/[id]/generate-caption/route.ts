import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { generateCaption } from '@/lib/caption'
import { Agent, Listing } from '@/types'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: listingData } = await db.database.from('listings').select('*').eq('id', params.id).maybeSingle()
    const listing = listingData as Listing | null
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const { data: agentData } = await db.database.from('agents').select('*').eq('name', listing.agent_name).maybeSingle()
    const agent = agentData as Agent | null

    const caption = await generateCaption({
      address: listing.address,
      city: listing.city,
      state: listing.state,
      status: listing.status,
      deal_side: listing.deal_side,
      agent_name: listing.agent_name,
      agent_instagram: agent?.instagram_handle ?? null,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      sqft_or_acreage: listing.sqft_or_acreage,
      price: listing.price,
      mls_description: listing.mls_description,
    })

    await db.database.from('listings').update({ generated_caption: caption }).eq('id', params.id)

    return NextResponse.json({ ok: true, caption })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
