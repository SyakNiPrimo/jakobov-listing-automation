import { NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { scanGmailInbox } from '@/lib/gmail'
import { Agent, Listing, ListingStatus, STATUS_PRIORITY } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export async function POST() {
  try {
    const luxuryThreshold = parseInt(process.env.LUXURY_PRICE_THRESHOLD || '1000000', 10)

    const { data: agentRows } = await db.database.from('agents').select('*')
    const agentList = (agentRows ?? []) as Agent[]
    const agentNames = agentList.map(a => a.name)

    const parsed = await scanGmailInbox(agentNames)

    const byMls = new Map<string, typeof parsed[0]>()
    for (const p of parsed) {
      const key = p.mls_number || `no-mls-${uuidv4()}`
      const existing = byMls.get(key)
      if (!existing) {
        byMls.set(key, p)
      } else {
        const existingPriority = existing.status ? STATUS_PRIORITY[existing.status] : -1
        const newPriority = p.status ? STATUS_PRIORITY[p.status as ListingStatus] : -1
        if (newPriority > existingPriority) {
          byMls.set(key, p)
        } else if (newPriority === existingPriority && p.email_received_at > existing.email_received_at) {
          byMls.set(key, p)
        }
      }
    }

    let created = 0, updated = 0, skipped = 0

    for (const p of Array.from(byMls.values())) {
      if (!p.status) continue

      const { data: existing } = await db.database
        .from('listings')
        .select('*')
        .eq('mls_number', p.mls_number || '')

      const existingListing = ((existing ?? []) as Listing[])[0]

      if (existingListing) {
        const statusChanged = existingListing.status !== p.status
        const isNewClose = p.status === 'Closed' && existingListing.status !== 'Closed'

        if (!statusChanged && existingListing.build_status === 'posted') { skipped++; continue }

        if (statusChanged || isNewClose) {
          await db.database.from('listings').update({
            status: p.status,
            price: p.price ?? existingListing.price,
            address: p.address ?? existingListing.address,
            agent_name: p.agent_name ?? existingListing.agent_name,
            photo_url: p.photo_url ?? existingListing.photo_url,
            email_received_at: p.email_received_at.toISOString(),
            is_luxury: (p.price ?? existingListing.price ?? 0) >= luxuryThreshold,
            build_status: 'ready',
          }).eq('id', existingListing.id)
          updated++
        } else { skipped++ }
      } else {
        await db.database.from('listings').insert([{
          id: uuidv4(),
          mls_number: p.mls_number,
          source: 'flexmls',
          deal_side: 'seller',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          zip: p.zip || '',
          price: p.price,
          status: p.status,
          agent_name: p.agent_name || '',
          is_luxury: (p.price ?? 0) >= luxuryThreshold,
          photo_url: p.photo_url,
          email_received_at: p.email_received_at.toISOString(),
          build_status: 'ready',
        }])
        created++
      }
    }

    return NextResponse.json({ ok: true, created, updated, skipped })
  } catch (err) {
    console.error('Scan error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
