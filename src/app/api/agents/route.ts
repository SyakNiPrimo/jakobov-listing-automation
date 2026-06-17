import { NextResponse } from 'next/server'
import { db } from '@/lib/insforge'

export async function GET() {
  try {
    const { data, error } = await db.from('agents').select('*').order('name').get()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
