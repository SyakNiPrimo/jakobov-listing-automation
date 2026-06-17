import { NextResponse } from 'next/server'
import { db } from '@/lib/insforge'

export async function GET() {
  try {
    const { data, error } = await db.database.from('agents').select('*').order('name', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
