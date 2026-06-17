'use client'

import { useEffect, useState } from 'react'
import { Agent, ListingStatus, DealSide } from '@/types'

interface Props {
  onClose: () => void
  onCreated: () => void
}

const STATUSES: ListingStatus[] = ['New Listing', 'Pending', 'Coming Soon', 'Closed']

export default function NewDealModal({ onClose, onCreated }: Props) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [status, setStatus] = useState<ListingStatus>('New Listing')
  const [dealSide, setDealSide] = useState<DealSide>('seller')
  const [agentName, setAgentName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('AZ')
  const [zip, setZip] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [sqft, setSqft] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(setAgents).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/listings/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        city,
        state,
        zip,
        status,
        deal_side: dealSide,
        agent_name: agentName,
        bedrooms: bedrooms ? parseFloat(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        sqft_or_acreage: sqft || null,
        price: price ? parseInt(price.replace(/,/g, ''), 10) : null,
        mls_description: description || null,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (res.ok) {
      onCreated()
    } else {
      setError(data.error?.message || JSON.stringify(data.error) || 'Failed to create listing')
    }
  }

  const inputStyle = {
    background: 'rgba(28,28,46,0.8)',
    border: '1px solid rgba(201,169,110,0.25)',
    color: 'var(--cream)',
    borderRadius: '6px',
    padding: '8px 12px',
    width: '100%',
    fontSize: '14px',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--gray)',
    marginBottom: '4px',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6"
        style={{ background: 'var(--navy)', border: '1px solid rgba(201,169,110,0.3)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-2xl" style={{ color: 'var(--gold)' }}>New Deal</h2>
          <button onClick={onClose} style={{ color: 'var(--gray)' }} className="text-lg hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as ListingStatus)} style={inputStyle}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Deal Side</label>
              <select value={dealSide} onChange={e => setDealSide(e.target.value as DealSide)} style={inputStyle}>
                <option value="seller">Seller</option>
                <option value="buyer">Buyer</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Agent</label>
            <select value={agentName} onChange={e => setAgentName(e.target.value)} style={inputStyle} required>
              <option value="">Select agent…</option>
              {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} required placeholder="123 Main St" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input type="text" value={state} onChange={e => setState(e.target.value)} style={inputStyle} required maxLength={2} />
            </div>
            <div>
              <label style={labelStyle}>ZIP</label>
              <input type="text" value={zip} onChange={e => setZip(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>Bedrooms</label>
              <input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} style={inputStyle} step="0.5" />
            </div>
            <div>
              <label style={labelStyle}>Bathrooms</label>
              <input type="number" value={bathrooms} onChange={e => setBathrooms(e.target.value)} style={inputStyle} step="0.5" />
            </div>
            <div>
              <label style={labelStyle}>Sq Ft / Acreage</label>
              <input type="text" value={sqft} onChange={e => setSqft(e.target.value)} style={inputStyle} placeholder="e.g. 1,963 sqft" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>{status === 'Closed' ? 'Closed Price' : 'Price'}</label>
            <input
              type="text"
              value={price}
              onChange={e => setPrice(e.target.value)}
              style={inputStyle}
              placeholder="e.g. 450000"
            />
          </div>

          <div>
            <label style={labelStyle}>MLS Description (for caption generation)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              placeholder="Paste the MLS property description here…"
            />
          </div>

          {error && <p className="text-sm" style={{ color: '#A04040' }}>{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: 'var(--gray)', border: '1px solid rgba(154,144,128,0.3)' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--gold)', color: 'var(--navy)' }}
            >
              {saving ? 'Saving…' : 'Add Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
