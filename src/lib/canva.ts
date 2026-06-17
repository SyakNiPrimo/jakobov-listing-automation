import { ListingStatus, Listing, Agent } from '@/types'

const CANVA_API = 'https://api.canva.com/rest/v1'

// Status → 1-based page index in the template
const STATUS_PAGE: Record<ListingStatus, number> = {
  'New Listing': 1,
  'Pending': 5,
  'Coming Soon': 9,
  'Closed': 11,
}

async function canvaFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CANVA_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.CANVA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Canva ${options.method || 'GET'} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export async function createListingDesign(listing: Listing, agent: Agent): Promise<{
  design_id: string
  export_url: string
}> {
  const templateId = process.env.CANVA_TEMPLATE_ID!
  const pageIndex = STATUS_PAGE[listing.status] - 1 // 0-based

  const luxuryThreshold = parseInt(process.env.LUXURY_PRICE_THRESHOLD || '1000000', 10)
  const logoAssetId = (listing.price ?? 0) >= luxuryThreshold
    ? process.env.CANVA_LOGO_LUXURY_ASSET_ID!
    : process.env.CANVA_LOGO_REGULAR_ASSET_ID!

  // 1. Create a copy of the template (single page matching the status)
  const copyRes = await canvaFetch('/designs', {
    method: 'POST',
    body: JSON.stringify({
      asset_type: 'design',
      design_type: { name: 'doc' },
      title: `${listing.status} – ${listing.address}`,
    }),
  })

  const designId: string = copyRes.design.id

  // 2. Get the design pages
  const pagesRes = await canvaFetch(`/designs/${designId}/pages`)
  const pages = pagesRes.items || []
  const targetPage = pages[pageIndex] || pages[0]
  const pageId: string = targetPage?.id

  // 3. Perform element replacements via autofill (Canva Connect API)
  const autofillRes = await canvaFetch(`/brand-templates/${templateId}/autofill`, {
    method: 'POST',
    body: JSON.stringify({
      title: `${listing.status} – ${listing.address}`,
      data: {
        // Text fields — keys must match the template's data field names
        address: { type: 'text', text: listing.address },
        agent_name: { type: 'text', text: agent.name },
        agent_email: { type: 'text', text: agent.email },
        agent_phone: { type: 'text', text: agent.phone },
        price: {
          type: 'text',
          text: listing.price
            ? `$${listing.price.toLocaleString()}`
            : '',
        },
        // Image fields — keys must match the template's data field names
        ...(listing.photo_url ? {
          listing_photo: {
            type: 'image',
            asset_id: listing.photo_url, // if URL, needs to be uploaded first
          },
        } : {}),
        ...(agent.canva_headshot_asset_id ? {
          agent_headshot: {
            type: 'image',
            asset_id: agent.canva_headshot_asset_id,
          },
        } : {}),
        exp_logo: {
          type: 'image',
          asset_id: logoAssetId,
        },
      },
    }),
  })

  const newDesignId: string = autofillRes.job?.result?.design?.id || designId

  // 4. Export the design as a PNG
  const exportRes = await canvaFetch(`/exports`, {
    method: 'POST',
    body: JSON.stringify({
      design_id: newDesignId,
      format: { type: 'png', lossless: false, height: 1080, width: 1080 },
      pages: [pageId],
    }),
  })

  const jobId: string = exportRes.job.id

  // 5. Poll for export completion
  let exportUrl = ''
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await canvaFetch(`/exports/${jobId}`)
    if (statusRes.job.status === 'success') {
      exportUrl = statusRes.job.urls?.[0] || ''
      break
    }
    if (statusRes.job.status === 'failed') {
      throw new Error('Canva export job failed')
    }
  }

  return { design_id: newDesignId, export_url: exportUrl }
}

export async function uploadImageToCanva(imageUrl: string): Promise<string> {
  const res = await canvaFetch('/assets', {
    method: 'POST',
    body: JSON.stringify({
      name: `listing-photo-${Date.now()}`,
      import_method: 'url',
      url: imageUrl,
    }),
  })
  // Poll until asset is ready
  const assetId: string = res.job.id
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const status = await canvaFetch(`/assets/${assetId}`)
    if (status.asset?.id) return status.asset.id
  }
  throw new Error('Canva asset upload timed out')
}
