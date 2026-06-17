import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/insforge'
import { BuildStatus, ListingStatus } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as ListingStatus | null
    const buildStatus = searchParams.get('build_status') as BuildStatus | null

    let query = db.from('listings').select('*').order('created_at', { ascending: false })

    // Note: InsForge QueryBuilder chains return `this` so filters stack
    if (status) query = query.eq('status', status)
    if (buildStatus) query = query.eq('build_status', buildStatus)

    const { data, error } = await query.get()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
