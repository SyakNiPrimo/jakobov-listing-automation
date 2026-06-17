import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const ManualListingSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  status: z.enum(['New Listing', 'Pending', 'Coming Soon', 'Closed']),
  deal_side: z.enum(['buyer', 'seller']),
  agent_name: z.string().min(1),
  bedrooms: z.number().nullable().optional(),
  bathrooms: z.number().nullable().optional(),
  sqft_or_acreage: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  mls_description: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ManualListingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const luxuryThreshold = parseInt(process.env.LUXURY_PRICE_THRESHOLD || '1000000', 10)
    const id = uuidv4()

    const { error } = await db.database.from('listings').insert([{
      id,
      mls_number: null,
      source: 'manual',
      deal_side: d.deal_side,
      address: d.address,
      city: d.city,
      state: d.state,
      zip: d.zip,
      price: d.price ?? null,
      status: d.status,
      agent_name: d.agent_name,
      bedrooms: d.bedrooms ?? null,
      bathrooms: d.bathrooms ?? null,
      sqft_or_acreage: d.sqft_or_acreage ?? null,
      mls_description: d.mls_description ?? null,
      is_luxury: (d.price ?? 0) >= luxuryThreshold,
      build_status: 'ready',
    }])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
