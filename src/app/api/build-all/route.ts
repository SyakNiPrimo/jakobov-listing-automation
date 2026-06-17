import { NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { Listing } from '@/types'

export async function POST() {
  try {
    const { data } = await db.from('listings').select('id').eq('build_status', 'ready').get()
    const listings = data as Pick<Listing, 'id'>[]

    const results = []
    for (const l of listings) {
      const res = await fetch(`${process.env.NEXTAUTH_URL}/api/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: l.id }),
      })
      results.push({ id: l.id, ok: res.ok })
    }

    const succeeded = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length
    return NextResponse.json({ ok: true, total: listings.length, succeeded, failed })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
