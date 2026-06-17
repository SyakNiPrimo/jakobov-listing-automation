import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await db.from('listings').eq('id', params.id).update({
      build_status: 'posted',
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
