import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await db.database.from('listings').update({
      build_status: 'posted',
      posted_at: new Date().toISOString(),
    }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
