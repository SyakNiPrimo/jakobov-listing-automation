'use client'

export default function SettingsPage() {
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

  const sectionStyle = {
    background: 'rgba(46,26,71,0.4)',
    border: '1px solid rgba(201,169,110,0.15)',
    borderRadius: '12px',
    padding: '24px',
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-headline text-3xl" style={{ color: 'var(--gold)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray)' }}>Configure integrations and automation settings</p>
      </div>

      {/* Gmail OAuth */}
      <div style={sectionStyle}>
        <h2 className="font-headline text-xl mb-4" style={{ color: 'var(--cream)' }}>Gmail Integration</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--gray)' }}>
          Connect Gmail to scan <strong style={{ color: 'var(--cream)' }}>ben@jakobovgroup.com</strong> for new listing emails from FlexMLS.
          Gmail credentials are configured via environment variables (<code style={{ color: 'var(--gold)' }}>GMAIL_CLIENT_ID</code>, <code style={{ color: 'var(--gold)' }}>GMAIL_CLIENT_SECRET</code>, <code style={{ color: 'var(--gold)' }}>GMAIL_REFRESH_TOKEN</code>).
        </p>
        <a
          href="/api/auth/gmail"
          className="inline-block px-4 py-2 rounded text-sm font-medium"
          style={{ background: 'var(--purple)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}
        >
          Connect Gmail Account
        </a>
      </div>

      {/* Canva OAuth */}
      <div style={sectionStyle}>
        <h2 className="font-headline text-xl mb-4" style={{ color: 'var(--cream)' }}>Canva Integration</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--gray)' }}>
          Connect Canva to auto-build designs from your templates.
          Configure via <code style={{ color: 'var(--gold)' }}>CANVA_CLIENT_ID</code> and <code style={{ color: 'var(--gold)' }}>CANVA_CLIENT_SECRET</code> env vars.
        </p>
        <a
          href="/api/auth/canva"
          className="inline-block px-4 py-2 rounded text-sm font-medium"
          style={{ background: 'var(--purple)', color: 'var(--gold)', border: '1px solid rgba(201,169,110,0.3)' }}
        >
          Connect Canva Account
        </a>
      </div>

      {/* Canva Template Config */}
      <div style={sectionStyle}>
        <h2 className="font-headline text-xl mb-4" style={{ color: 'var(--cream)' }}>Canva Template Settings</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--gray)' }}>
          Set these values in your environment variables or Vercel project settings. Page numbers are 1-based.
        </p>
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>Template ID (CANVA_TEMPLATE_ID)</label>
            <input type="text" style={inputStyle} placeholder="e.g. DAF..." readOnly value={process.env.NEXT_PUBLIC_CANVA_TEMPLATE_ID || ''} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: 'var(--gray)' }}>
            <div className="p-3 rounded" style={{ background: 'rgba(28,28,46,0.5)' }}>New Listing → Page 1</div>
            <div className="p-3 rounded" style={{ background: 'rgba(28,28,46,0.5)' }}>Pending → Page 5</div>
            <div className="p-3 rounded" style={{ background: 'rgba(28,28,46,0.5)' }}>Coming Soon → Page 9</div>
            <div className="p-3 rounded" style={{ background: 'rgba(28,28,46,0.5)' }}>Closed → Page 11</div>
          </div>
          <div>
            <label style={labelStyle}>Headshots Folder ID (CANVA_HEADSHOTS_FOLDER_ID)</label>
            <input type="text" style={inputStyle} placeholder="e.g. FAF..." readOnly />
          </div>
        </div>
      </div>

      {/* Logo Config */}
      <div style={sectionStyle}>
        <h2 className="font-headline text-xl mb-4" style={{ color: 'var(--cream)' }}>eXp Logo Settings</h2>
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>Regular Logo Asset ID (CANVA_LOGO_REGULAR_ASSET_ID)</label>
            <input type="text" style={inputStyle} placeholder="Canva asset ID for regular eXp logo" readOnly />
          </div>
          <div>
            <label style={labelStyle}>Luxury Logo Asset ID (CANVA_LOGO_LUXURY_ASSET_ID)</label>
            <input type="text" style={inputStyle} placeholder="Canva asset ID for luxury eXp logo" readOnly />
          </div>
          <div>
            <label style={labelStyle}>Luxury Price Threshold (LUXURY_PRICE_THRESHOLD)</label>
            <input type="text" style={inputStyle} defaultValue="1000000" readOnly />
            <p className="text-xs mt-1" style={{ color: 'var(--gray)' }}>Listings at or above this price use the luxury logo. Default: $1,000,000.</p>
          </div>
        </div>
      </div>

      {/* Daily Schedule */}
      <div style={sectionStyle}>
        <h2 className="font-headline text-xl mb-4" style={{ color: 'var(--cream)' }}>Automated Daily Scan</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--gray)' }}>
          Set up a daily cron job in Vercel (or your scheduler of choice) to call <code style={{ color: 'var(--gold)' }}>POST /api/scan</code> each morning.
          In Vercel, add this to <code style={{ color: 'var(--gold)' }}>vercel.json</code>:
        </p>
        <pre className="text-xs p-3 rounded overflow-x-auto" style={{ background: 'rgba(28,28,46,0.8)', color: 'var(--cream)', border: '1px solid rgba(201,169,110,0.15)' }}>
{`{
  "crons": [
    {
      "path": "/api/scan",
      "schedule": "0 8 * * *"
    }
  ]
}`}
        </pre>
        <p className="text-xs mt-2" style={{ color: 'var(--gray)' }}>Runs at 8:00 AM UTC daily. Adjust the cron schedule as needed.</p>
      </div>
    </div>
  )
}
