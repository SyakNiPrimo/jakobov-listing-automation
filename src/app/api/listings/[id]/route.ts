import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await db.from('listings').eq('id', params.id).delete()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await db.from('listings').select('*').eq('id', params.id).get()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const listing = (data as unknown[])[0]
    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(listing)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
