import { google, gmail_v1 } from 'googleapis'
import * as cheerio from 'cheerio'
import { ListingStatus, STATUS_PRIORITY, VALID_STATUSES } from '@/types'

const SENDER = 'listingupdates@flexmail.flexmls.com'

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

function decodeBody(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractHtmlBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBody(payload.body.data)
  }
  for (const part of payload.parts || []) {
    const html = extractHtmlBody(part)
    if (html) return html
  }
  return ''
}

export interface ParsedListing {
  mls_number: string | null
  status: ListingStatus | null
  price: number | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  agent_name: string | null
  photo_url: string | null
  email_received_at: Date
}

/**
 * Try to match an agent name from arbitrary text against the known agents list.
 * Returns the first full match found.
 */
function matchAgentInText(text: string, agentNames: string[]): string | null {
  const lower = text.toLowerCase()
  // Full name match first (most reliable)
  for (const name of agentNames) {
    if (lower.includes(name.toLowerCase())) return name
  }
  // First-name possessive: "Ari's Listing", "James's Closed Deals"
  const possessive = text.match(/([A-Z][a-z]{1,20})'s/g) || []
  for (const p of possessive) {
    const first = p.replace(/'s$/, '').toLowerCase()
    const found = agentNames.find(n => n.toLowerCase().startsWith(first + ' '))
    if (found) return found
  }
  return null
}

/**
 * Fetch the Flexmls listing page and extract:
 *  - Agent name (matched against known agents)
 *  - High-res photo URL
 *  - Full address, city, state, zip (as fallback if email parsing missed them)
 */
async function enrichFromListingPage(
  viewListingUrl: string,
  agentNames: string[],
): Promise<{ agent_name: string | null; photo_url: string | null }> {
  try {
    const res = await fetch(viewListingUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return { agent_name: null, photo_url: null }

    const html = await res.text()
    const $ = cheerio.load(html)
    const pageText = $('body').text()

    // Agent name from page text
    const agent_name = matchAgentInText(pageText, agentNames)

    // Best photo: prefer large CDN photos, fall back to any img
    let photo_url: string | null = null
    const imgSrcs: string[] = []
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src) imgSrcs.push(src)
    })
    // Prefer sparkplatform CDN or large images
    photo_url =
      imgSrcs.find(s => s.includes('cdn.photos.sparkplatform.com') && /large|hd|full|\d{3,}x\d{3,}/i.test(s)) ||
      imgSrcs.find(s => s.includes('cdn.photos.sparkplatform.com')) ||
      imgSrcs.find(s => /\.(jpg|jpeg|png|webp)/i.test(s) && !s.includes('logo') && !s.includes('icon')) ||
      null

    return { agent_name, photo_url }
  } catch {
    return { agent_name: null, photo_url: null }
  }
}

/**
 * Parse all listing blocks out of a single email's HTML.
 *
 * Flexmls emails contain one or more listing blocks, each with:
 *   [$PRICE]
 *   [Address as hyperlink]
 *   [City, AZ ZIP • #MLSNUMBER]
 *   [Status text]
 *   [VIEW LISTING button/link]
 */
async function parseEmail(
  html: string,
  subject: string,
  receivedAt: Date,
  agentNames: string[],
): Promise<ParsedListing[]> {
  const $ = cheerio.load(html)
  const results: ParsedListing[] = []

  // Collect all "VIEW LISTING" links — one per listing block
  const viewLinks: string[] = []
  $('a').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim().toLowerCase()
    if ((text.includes('view listing') || text.includes('view') ) && href.startsWith('http')) {
      if (!viewLinks.includes(href)) viewLinks.push(href)
    }
  })

  // Also find listing blocks by price pattern
  // Walk through all text-containing elements to find price markers
  const listingBlocks: Array<{
    price: number
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    mls_number: string | null
    status: ListingStatus | null
    photo_url: string | null
    view_url: string | null
  }> = []

  // Find all elements that contain only a price (leaf nodes)
  $('*').each((_, el) => {
    const $el = $(el)
    if ($el.children('*').length > 2) return // skip containers
    const text = $el.text().trim()
    const priceMatch = text.match(/^\$\s?([\d,]+)$/)
    if (!priceMatch) return

    const price = parseInt(priceMatch[1].replace(/,/g, ''), 10)
    if (price < 50000 || price > 50000000) return

    // Find the surrounding block (go up 2–4 levels to get the listing card)
    const block = $el.closest('td, div, table').first()
    const blockHtml = block.html() || ''
    const blockText = block.text()

    // Address: first <a> in block whose text looks like a street address
    let address: string | null = null
    let viewUrl: string | null = null
    block.find('a').each((_, a) => {
      const href = $(a).attr('href') || ''
      const linkText = $(a).text().trim()
      if (/^\d+\s+\S/.test(linkText) && !address) {
        address = linkText
      }
      if (($(a).text().toLowerCase().includes('view') || href.includes('flexmls') || href.includes('flexmls'))) {
        if (href.startsWith('http') && !viewUrl) viewUrl = href
      }
    })

    // City / State / ZIP / MLS line
    // Formats: "Scottsdale, AZ 85251 • #7042534"
    //          "234, Scottsdale, AZ 85251 • #7042534" (unit number prefix)
    let city: string | null = null, state: string | null = null
    let zip: string | null = null, mls_number: string | null = null

    const cityLine = blockText.match(
      /(?:\d+,\s*)?([A-Za-z ]+),\s*([A-Z]{2})\s+(\d{5})\s*[•·\-]\s*#?(\d{5,})/
    )
    if (cityLine) {
      city = cityLine[1].trim()
      state = cityLine[2]
      zip = cityLine[3]
      mls_number = cityLine[4]
    }

    // MLS fallback
    if (!mls_number) {
      const mlsFallback = blockText.match(/#(\d{5,})/) || blockHtml.match(/#(\d{5,})/)
      if (mlsFallback) mls_number = mlsFallback[1]
    }

    // Status
    let status: ListingStatus | null = null
    for (const s of VALID_STATUSES) {
      if (new RegExp(s, 'i').test(blockText)) {
        if (!status || STATUS_PRIORITY[s] > STATUS_PRIORITY[status]) status = s
      }
    }

    // Photo in block
    let photo_url: string | null = null
    block.find('img').each((_, img) => {
      const src = $(img).attr('src')
      if (src && !photo_url) photo_url = src
    })

    if (status) {
      listingBlocks.push({ price, address, city, state, zip, mls_number, status, photo_url, view_url: viewUrl })
    }
  })

  // If no blocks found via price elements, try a fallback: parse whole email text
  if (listingBlocks.length === 0) {
    const fullText = $('body').text()
    const priceMatches = Array.from(fullText.matchAll(/\$([\d,]+)/g))
    for (const pm of priceMatches) {
      const price = parseInt(pm[1].replace(/,/g, ''), 10)
      if (price < 50000 || price > 50000000) continue

      const cityLine = fullText.match(/(?:\d+,\s*)?([A-Za-z ]+),\s*([A-Z]{2})\s+(\d{5})\s*[•·\-]\s*#?(\d{5,})/)
      const mlsFallback = fullText.match(/#(\d{5,})/)
      let status: ListingStatus | null = null
      for (const s of VALID_STATUSES) {
        if (new RegExp(s, 'i').test(fullText)) {
          if (!status || STATUS_PRIORITY[s] > STATUS_PRIORITY[status]) status = s
        }
      }
      if (status) {
        listingBlocks.push({
          price,
          address: null,
          city: cityLine?.[1]?.trim() || null,
          state: cityLine?.[2] || null,
          zip: cityLine?.[3] || null,
          mls_number: cityLine?.[4] || mlsFallback?.[1] || null,
          status,
          photo_url: null,
          view_url: viewLinks[0] || null,
        })
        break // one listing per fallback parse
      }
    }
  }

  // For each block, enrich from the listing page
  // Try to match agent from subject + full email body first
  const emailBodyText = $('body').text()
  const agentFromEmail = matchAgentInText(subject + ' ' + emailBodyText, agentNames)

  for (let i = 0; i < listingBlocks.length; i++) {
    const block = listingBlocks[i]
    // Use the view_url for this block, or fall back to viewLinks[i]
    const viewUrl = block.view_url || viewLinks[i] || null

    let agent_name = agentFromEmail
    let photo_url = block.photo_url

    if (viewUrl) {
      const enriched = await enrichFromListingPage(viewUrl, agentNames)
      if (enriched.agent_name) agent_name = enriched.agent_name
      if (enriched.photo_url) photo_url = enriched.photo_url
    }

    results.push({
      mls_number: block.mls_number,
      status: block.status,
      price: block.price,
      address: block.address,
      city: block.city,
      state: block.state,
      zip: block.zip,
      agent_name,
      photo_url,
      email_received_at: receivedAt,
    })
  }

  // Deduplicate by MLS within this email
  const byMls = new Map<string, ParsedListing>()
  for (const r of results) {
    const key = r.mls_number || `addr-${r.address}-${r.price}`
    const existing = byMls.get(key)
    if (!existing) {
      byMls.set(key, r)
    } else if (r.status && existing.status && STATUS_PRIORITY[r.status] > STATUS_PRIORITY[existing.status]) {
      byMls.set(key, r)
    }
  }

  return Array.from(byMls.values())
}

export async function scanGmailInbox(agentNames: string[]): Promise<ParsedListing[]> {
  const gmail = getGmailClient()

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `from:${SENDER} after:2026/06/01 before:2026/07/01`,
    maxResults: 500,
  })

  const messages = listRes.data.messages || []
  const allListings: ParsedListing[] = []

  for (const msg of messages) {
    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      })

      const payload = full.data.payload!
      const subject = payload.headers?.find(h => h.name === 'Subject')?.value || ''
      const dateStr = payload.headers?.find(h => h.name === 'Date')?.value || ''
      const receivedAt = new Date(dateStr)

      const html = extractHtmlBody(payload)
      if (!html) continue

      const listings = await parseEmail(html, subject, receivedAt, agentNames)
      allListings.push(...listings)
    } catch (err) {
      console.error(`Failed to parse message ${msg.id}:`, err)
    }
  }

  return allListings
}
