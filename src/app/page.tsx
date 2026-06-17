'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Listing, ListingStatus, BuildStatus, STATUS_PRIORITY } from '@/types'
import NewDealModal from '@/components/NewDealModal'

const STATUS_COLORS: Record<ListingStatus, string> = {
  'New Listing': '#C9A96E',
  'Pending': '#7B5EA7',
  'Coming Soon': '#4A7B9D',
  'Closed': '#3D7A5C',
}

const BUILD_STATUS_COLORS: Record<BuildStatus, string> = {
  ready: '#C9A96E',
  built: '#4A7B9D',
  posted: '#3D7A5C',
  error: '#A04040',
}

type FilterTab = 'all' | ListingStatus | 'luxury' | 'built' | 'not_built'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'New Listing', label: 'New Listing' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Coming Soon', label: 'Coming Soon' },
  { key: 'Closed', label: 'Closed' },
  { key: 'luxury', label: 'Luxury ($1M+)' },
  { key: 'built', label: 'Built' },
  { key: 'not_built', label: 'Not Built Yet' },
]

function sortListings(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 0
    const pb = STATUS_PRIORITY[b.status] ?? 0
    if (pb !== pa) return pb - pa
    return new Date(b.email_received_at || b.created_at).getTime() -
      new Date(a.email_received_at || a.created_at).getTime()
  })
}

function filterListings(listings: Listing[], tab: FilterTab): Listing[] {
  switch (tab) {
    case 'all': return listings
    case 'luxury': return listings.filter(l => l.is_luxury)
    case 'built': return listings.filter(l => l.build_status === 'built' || l.build_status === 'posted')
    case 'not_built': return listings.filter(l => l.build_status === 'ready' || l.build_status === 'error')
    default: return listings.filter(l => l.status === tab)
  }
}

export default function Dashboard() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('all')
  const [scanning, setScanning] = useState(false)
  const [buildingAll, setBuildingAll] = useState(false)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/listings')
    if (res.ok) setListings(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchListings() }, [fetchListings])

  const handleScan = async () => {
    setScanning(true)
    const res = await fetch('/api/scan', { method: 'POST' })
    const data = await res.json()
    setScanning(false)
    if (res.ok) {
      showToast(`Scan complete: ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`)
      fetchListings()
    } else {
      showToast(`Scan failed: ${data.error}`, false)
    }
  }

  const handleBuildAll = async () => {
    setBuildingAll(true)
    const res = await fetch('/api/build-all', { method: 'POST' })
    const data = await res.json()
    setBuildingAll(false)
    if (res.ok) {
      showToast(`Built ${data.succeeded} / ${data.total}`)
      fetchListings()
    } else {
      showToast(`Build failed: ${data.error}`, false)
    }
  }

  const handleBuild = async (id: string) => {
    const res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: id }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast('Design built successfully')
      fetchListings()
    } else {
      showToast(`Build failed: ${data.error}`, false)
    }
  }

  const handleMarkPosted = async (id: string) => {
    const res = await fetch(`/api/listings/${id}/mark-posted`, { method: 'POST' })
    if (res.ok) {
      showToast('Marked as posted')
      fetchListings()
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this listing?')) return
    const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Removed')
      fetchListings()
    }
  }

  const sorted = sortListings(filterListings(listings, tab))

  const stats = {
    total: listings.length,
    ready: listings.filter(l => l.build_status === 'ready').length,
    built: listings.filter(l => l.build_status === 'built').length,
    posted: listings.filter(l => l.build_status === 'posted').length,
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded text-sm font-medium shadow-lg"
          style={{ background: toast.ok ? '#3D7A5C' : '#A04040', color: '#fff' }}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl" style={{ color: 'var(--gold)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--gray)' }}>The Jakobov Group — Listing Social Media Tracker</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 rounded text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--purple)', color: 'var(--cream)', border: '1px solid rgba(201,169,110,0.3)' }}
          >
            {scanning ? 'Scanning…' : 'Scan Inbox Now'}
          </button>
          <button
            onClick={handleBuildAll}
            disabled={buildingAll}
            className="px-4 py-2 rounded text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--purple)', color: 'var(--cream)', border: '1px solid rgba(201,169,110,0.3)' }}
          >
            {buildingAll ? 'Building…' : 'Build All Ready'}
          </button>
          <button
            onClick={() => setShowNewDeal(true)}
            className="px-4 py-2 rounded text-sm font-semibold"
            style={{ background: 'var(--gold)', color: 'var(--navy)' }}
          >
            + New Deal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Listings', value: stats.total },
          { label: 'Ready to Build', value: stats.ready, color: '#C9A96E' },
          { label: 'Built', value: stats.built, color: '#4A7B9D' },
          { label: 'Posted', value: stats.posted, color: '#3D7A5C' },
        ].map(card => (
          <div
            key={card.label}
            className="rounded-lg px-5 py-4"
            style={{ background: 'rgba(46,26,71,0.5)', border: '1px solid rgba(201,169,110,0.15)' }}
          >
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--gray)' }}>{card.label}</div>
            <div className="font-headline text-3xl" style={{ color: card.color || 'var(--cream)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: tab === t.key ? 'var(--gold)' : 'rgba(46,26,71,0.5)',
              color: tab === t.key ? 'var(--navy)' : 'var(--gray)',
              border: '1px solid rgba(201,169,110,0.2)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(201,169,110,0.15)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(46,26,71,0.8)', color: 'var(--gray)' }}>
              {['Address', 'MLS #', 'Side', 'Agent', 'Price', 'Status', 'Received', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-12" style={{ color: 'var(--gray)' }}>Loading…</td>
              </tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12" style={{ color: 'var(--gray)' }}>No listings found.</td>
              </tr>
            )}
            {sorted.map((l, i) => (
              <tr
                key={l.id}
                style={{
                  background: i % 2 === 0 ? 'rgba(28,28,46,0.6)' : 'rgba(46,26,71,0.3)',
                  borderBottom: '1px solid rgba(201,169,110,0.08)',
                }}
              >
                <td className="px-4 py-3">
                  <Link href={`/listings/${l.id}`} className="hover:underline font-medium" style={{ color: 'var(--cream)' }}>
                    {l.address}
                  </Link>
                  {l.city && <div className="text-xs mt-0.5" style={{ color: 'var(--gray)' }}>{l.city}, {l.state}</div>}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--gray)' }}>
                  {l.mls_number ? `#${l.mls_number}` : (
                    <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(201,169,110,0.2)', color: 'var(--gold)' }}>Manual</span>
                  )}
                </td>
                <td className="px-4 py-3 capitalize" style={{ color: 'var(--gray)' }}>{l.deal_side}</td>
                <td className="px-4 py-3" style={{ color: 'var(--cream)' }}>{l.agent_name || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span style={{ color: l.is_luxury ? '#C9A96E' : 'var(--cream)' }}>
                    {l.price ? `$${l.price.toLocaleString()}` : '—'}
                  </span>
                  {l.is_luxury && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: 'rgba(201,169,110,0.2)', color: 'var(--gold)' }}>LUXURY</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${STATUS_COLORS[l.status]}22`, color: STATUS_COLORS[l.status] }}>
                      {l.status}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${BUILD_STATUS_COLORS[l.build_status]}22`, color: BUILD_STATUS_COLORS[l.build_status] }}>
                      {l.build_status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--gray)' }}>
                  {l.email_received_at
                    ? new Date(l.email_received_at).toLocaleDateString()
                    : new Date(l.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {(l.build_status === 'ready' || l.build_status === 'error') && (
                      <button onClick={() => handleBuild(l.id)} className="px-2 py-1 rounded text-xs font-medium" style={{ background: 'var(--purple)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}>
                        Build
                      </button>
                    )}
                    {l.build_status === 'built' && (
                      <button onClick={() => handleMarkPosted(l.id)} className="px-2 py-1 rounded text-xs font-medium" style={{ background: '#3D7A5C22', color: '#3D7A5C', border: '1px solid #3D7A5C44' }}>
                        Mark Posted
                      </button>
                    )}
                    {l.canva_export_url && (
                      <a href={l.canva_export_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded text-xs font-medium" style={{ background: 'rgba(201,169,110,0.15)', color: 'var(--gold)' }}>
                        View
                      </a>
                    )}
                    <button onClick={() => handleRemove(l.id)} className="px-2 py-1 rounded text-xs font-medium" style={{ color: '#A04040', border: '1px solid #A0404033' }}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreated={() => { setShowNewDeal(false); fetchListings() }}
        />
      )}
    </div>
  )
}
