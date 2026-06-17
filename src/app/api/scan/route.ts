import { NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { scanGmailInbox } from '@/lib/gmail'
import { Agent, ListingStatus, STATUS_PRIORITY } from '@/types'
import { v4 as uuidv4 } from 'uuid'

function isValidMls(mls: string | null | undefined): mls is string {
  if (!mls) return false
  if (mls.length < 5) return false
  if (/^0+$/.test(mls)) return false
  return true
}

export async function POST() {
  try {
    const luxuryThreshold = parseInt(process.env.LUXURY_PRICE_THRESHOLD || '1000000', 10)

    const { data: agentRows } = await db.database.from('agents').select('*')
    const agentList = (agentRows ?? []) as Agent[]
    const agentNames = agentList.map(a => a.name)

    const { listings: parsed, skipped: emailsSkipped } = await scanGmailInbox(agentNames)

    // ── Validation ─────────────────────────────────────────────────────────────
    // Drop any row that has no valid MLS number or no address — these are garbage
    // rows from parsing failures and would insert as duplicates with no key.
    let validationSkipped = 0
    const validParsed = parsed.filter(p => {
      if (!isValidMls(p.mls_number)) { validationSkipped++; return false }
      if (!p.address || p.address.trim() === '') { validationSkipped++; return false }
      if (!p.status) { validationSkipped++; return false }
      return true
    })

    // ── In-memory dedup keyed by MLS: keep highest-priority status, then latest ─
    const byMls = new Map<string, typeof validParsed[0]>()
    for (const p of validParsed) {
      const existing = byMls.get(p.mls_number!)
      if (!existing) {
        byMls.set(p.mls_number!, p)
      } else {
        const existingPriority = existing.status ? STATUS_PRIORITY[existing.status] : -1
        const newPriority = p.status ? STATUS_PRIORITY[p.status as ListingStatus] : -1
        if (newPriority > existingPriority) {
          byMls.set(p.mls_number!, p)
        } else if (newPriority === existingPriority && p.email_received_at > existing.email_received_at) {
          byMls.set(p.mls_number!, p)
        }
      }
    }

    let created = 0, updated = 0, skipped = 0

    for (const p of Array.from(byMls.values())) {
      if (!p.status || !p.mls_number) continue

      const { data: existing } = await db.database
        .from('listings')
        .select('*')
        .eq('mls_number', p.mls_number)

      const existingListing = (existing ?? [])[0] as Record<string, unknown> | undefined

      if (existingListing) {
        const existingStatus = existingListing.status as ListingStatus
        const existingBuildStatus = existingListing.build_status as string
        const statusChanged = existingStatus !== p.status

        // Don't rebuild if already posted and status hasn't changed
        if (!statusChanged && existingBuildStatus === 'posted') { skipped++; continue }

        if (statusChanged) {
          await db.database.from('listings').update({
            status: p.status,
            price: p.price ?? existingListing.price,
            address: p.address ?? existingListing.address,
            agent_name: p.agent_name ?? existingListing.agent_name,
            photo_url: p.photo_url ?? existingListing.photo_url,
            email_received_at: p.email_received_at.toISOString(),
            is_luxury: (p.price ?? (existingListing.price as number) ?? 0) >= luxuryThreshold,
            build_status: 'ready',
          }).eq('mls_number', p.mls_number)
          updated++
        } else { skipped++ }
      } else {
        await db.database.from('listings').insert([{
          id: uuidv4(),
          mls_number: p.mls_number,
          source: 'flexmls',
          deal_side: 'seller',
          address: p.address,
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

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      validation_skipped: validationSkipped,
      emails_skipped: emailsSkipped,
    })
  } catch (err) {
    console.error('Scan error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
