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
  bedrooms: number | null
  bathrooms: number | null
  sqft_or_acreage: string | null
  email_received_at: Date
}

function matchAgentInText(text: string, agentNames: string[]): string | null {
  const lower = text.toLowerCase()
  for (const name of agentNames) {
    if (lower.includes(name.toLowerCase())) return name
  }
  // First-name possessive: "Ari's Listing", "James's Closed Deals"
  const possessiveMatches = text.match(/([A-Z][a-z]{1,20})'s/g) || []
  for (const p of possessiveMatches) {
    const first = p.replace(/'s$/, '').toLowerCase()
    const found = agentNames.find(n => n.toLowerCase().startsWith(first + ' '))
    if (found) return found
  }
  return null
}

interface ListingPageDetails {
  photo_url: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft_or_acreage: string | null
}

async function fetchListingPageDetails(url: string): Promise<ListingPageDetails> {
  const empty: ListingPageDetails = { photo_url: null, bedrooms: null, bathrooms: null, sqft_or_acreage: null }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return empty
    const html = await res.text()
    const $ = cheerio.load(html)

    // ── Photo ──────────────────────────────────────────────────────────────
    let photo_url: string | null = null
    $('img').each((_, el) => {
      if (photo_url) return
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (src.includes('cdn.photos.sparkplatform.com')) photo_url = src
    })
    if (!photo_url) {
      $('img').each((_, el) => {
        if (photo_url) return
        const src = $(el).attr('src') || ''
        if (/\.(jpg|jpeg|png|webp)/i.test(src) && !src.includes('logo') && !src.includes('icon')) {
          photo_url = src
        }
      })
    }

    // ── Bed / Bath / Sqft — scan full page text for labeled values ─────────
    // Flexmls pages render these as labelled pairs in tables or definition lists.
    // We search the full text for patterns like "3 Beds", "2 Baths", "1,850 Sq Ft".
    const pageText = $('body').text().replace(/\s+/g, ' ')

    let bedrooms: number | null = null
    let bathrooms: number | null = null
    let sqft_or_acreage: string | null = null

    // Bedrooms: "3 Bed", "3 Beds", "3 Bedroom", "Beds: 3", "Bedrooms 3"
    const bedMatch = pageText.match(/(\d+)\s*(?:Bed(?:room)?s?)\b/i)
      ?? pageText.match(/\bBed(?:room)?s?\s*[:\-]?\s*(\d+)/i)
    if (bedMatch) {
      const n = parseInt(bedMatch[1] ?? bedMatch[2] ?? '', 10)
      if (!isNaN(n) && n > 0 && n < 30) bedrooms = n
    }

    // Bathrooms: "2 Bath", "2 Baths", "2.5 Baths", "Baths: 2"
    const bathMatch = pageText.match(/(\d+(?:\.\d+)?)\s*(?:Bath(?:room)?s?)\b/i)
      ?? pageText.match(/\bBath(?:room)?s?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i)
    if (bathMatch) {
      const n = parseFloat(bathMatch[1] ?? bathMatch[2] ?? '')
      if (!isNaN(n) && n > 0 && n < 20) bathrooms = n
    }

    // Sqft: "1,850 Sq Ft", "1850 SqFt", "1,850 Square Feet"
    const sqftMatch = pageText.match(/([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet)/i)
    if (sqftMatch) {
      const val = sqftMatch[1].replace(/,/g, '')
      const n = parseInt(val, 10)
      if (!isNaN(n) && n > 100 && n < 50000) sqft_or_acreage = `${n.toLocaleString()} sq ft`
    }

    // Acreage fallback: "2.5 Acres", "0.75 Acre"
    if (!sqft_or_acreage) {
      const acreMatch = pageText.match(/([\d.]+)\s*Acres?/i)
      if (acreMatch) {
        const n = parseFloat(acreMatch[1])
        if (!isNaN(n) && n > 0 && n < 10000) sqft_or_acreage = `${n} acres`
      }
    }

    return { photo_url, bedrooms, bathrooms, sqft_or_acreage }
  } catch {
    return empty
  }
}

/**
 * Validate an MLS number: must be 5+ digits and not all zeros.
 */
function isValidMls(mls: string | null): mls is string {
  if (!mls) return false
  if (mls.length < 5) return false
  if (/^0+$/.test(mls)) return false
  return true
}

/**
 * Parse listing blocks from a Flexmls email.
 *
 * The email format per listing block is:
 *   $PRICE
 *   ADDRESS (as link)
 *   City, AZ ZIP • #MLSNUMBER
 *   STATUS        ← word immediately before "View Listing"
 *   [VIEW LISTING button]
 *
 * We anchor status extraction to the "View Listing" position so we don't
 * accidentally pick up status words from checklists, footers, or other listings.
 */
async function parseEmail(
  html: string,
  subject: string,
  receivedAt: Date,
  agentNames: string[],
): Promise<ParsedListing[]> {
  const $ = cheerio.load(html)
  const results: ParsedListing[] = []

  // Find every "View Listing" link — one per listing block
  const viewListingLinks: { url: string; el: cheerio.Element }[] = []
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase()
    const href = $(el).attr('href') || ''
    if (text.includes('view listing') && href.startsWith('http')) {
      viewListingLinks.push({ url: href, el })
    }
  })

  // If no "View Listing" links found, nothing actionable in this email
  if (viewListingLinks.length === 0) {
    console.log(`[gmail] No VIEW LISTING links in: "${subject}" — skipping`)
    return []
  }

  for (const { url: viewUrl, el: viewEl } of viewListingLinks) {
    // Walk up from the "View Listing" link to find the listing card container.
    // We go up until we find a container that also contains a price ($NNN,NNN).
    let container = $(viewEl).parent()
    for (let i = 0; i < 8; i++) {
      if (/\$[\d,]+/.test(container.text())) break
      const parent = container.parent()
      if (!parent.length) break
      container = parent
    }

    const blockText = container.text().replace(/\s+/g, ' ').trim()

    // ── Price ──────────────────────────────────────────────────────────────
    const priceMatch = blockText.match(/\$\s?([\d,]+)/)
    if (!priceMatch) {
      console.log(`[gmail] No price in block for view url: ${viewUrl}`)
      continue
    }
    const price = parseInt(priceMatch[1].replace(/,/g, ''), 10)
    if (price < 50000 || price > 50000000) continue

    // ── Status — anchored to text IMMEDIATELY before "View Listing" ────────
    // Take only the text that comes before "view listing" in the block
    const viewIdx = blockText.toLowerCase().indexOf('view listing')
    const beforeView = viewIdx > 0 ? blockText.slice(0, viewIdx).trim() : blockText

    let status: ListingStatus | null = null
    // Check each valid status against the end of beforeView (most specific anchor)
    for (const s of VALID_STATUSES) {
      const re = new RegExp(s.replace(' ', '\\s+') + '\\s*$', 'i')
      if (re.test(beforeView)) {
        status = s
        break
      }
    }
    // Fallback: check if the status appears anywhere in beforeView but not in afterView
    if (!status) {
      for (const s of VALID_STATUSES) {
        if (new RegExp(s, 'i').test(beforeView)) {
          if (!status || STATUS_PRIORITY[s] > STATUS_PRIORITY[status]) status = s
        }
      }
    }

    if (!status) {
      console.log(`[gmail] Could not determine status for block (beforeView tail: "${beforeView.slice(-60)}")`)
      continue
    }

    // ── MLS number ─────────────────────────────────────────────────────────
    // Format: "• #7011076" or "#7042534"
    const mlsMatch = beforeView.match(/[•·]\s*#?(\d{5,})/) || beforeView.match(/#(\d{5,})/)
    const mls_number = mlsMatch ? mlsMatch[1] : null

    if (!isValidMls(mls_number)) {
      console.log(`[gmail] Invalid/missing MLS "${mls_number}" — skipping block`)
      continue
    }

    // ── Address ────────────────────────────────────────────────────────────
    // Address is a hyperlink inside the container
    let address: string | null = null
    container.find('a').each((_, a) => {
      if (address) return
      const linkText = $(a).text().trim()
      // Street address: starts with a number followed by a word
      if (/^\d+\s+\S/.test(linkText) && linkText.length > 5 && linkText.length < 100) {
        address = linkText
      }
    })

    if (!address) {
      // Try extracting from text: number + street name before the city line
      const addrMatch = beforeView.match(/(\d+\s+[A-Za-z0-9 .#'-]+?)\s+(?:[A-Za-z ]+,\s*[A-Z]{2}\s+\d{5})/)
      if (addrMatch) address = addrMatch[1].trim()
    }

    if (!address) {
      console.log(`[gmail] No address found for MLS #${mls_number} — skipping`)
      continue
    }

    // ── City / State / ZIP ─────────────────────────────────────────────────
    // Slice beforeView to only the text AFTER the address to avoid the street
    // name matching the city pattern (e.g. "W ADAMANDA Drive Phoenix, AZ 85XXX")
    const afterAddress = address
      ? beforeView.slice(beforeView.indexOf(address) + address.length)
      : beforeView
    const cityMatch = afterAddress.match(/([A-Za-z][A-Za-z ]{1,25}),\s*([A-Z]{2})\s+(\d{5})/)
    const city = cityMatch?.[1]?.trim() || null
    const state = cityMatch?.[2] || null
    const zip = cityMatch?.[3] || null

    // ── Photo ──────────────────────────────────────────────────────────────
    let photo_url: string | null = null
    container.find('img').each((_, img) => {
      if (photo_url) return
      const src = $(img).attr('src') || ''
      if (src && !src.includes('logo') && !src.includes('icon')) photo_url = src
    })

    // ── Agent — from email subject possessive ("James's Closed Deals") ───────
    // We deliberately do NOT use the listing page for agent matching because
    // the team lead (Ari Jakobov) appears on every FlexMLS page and would
    // override the correct agent name derived from the email subject.
    const agent_name: string | null = matchAgentInText(subject, agentNames)

    // ── Listing page: hi-res photo + bed/bath/sqft in one fetch ───────────
    const pageDetails = await fetchListingPageDetails(viewUrl)
    const hiResPhoto = pageDetails.photo_url ?? photo_url

    results.push({
      mls_number,
      status,
      price,
      address,
      city,
      state,
      zip,
      agent_name,
      photo_url: hiResPhoto,
      bedrooms: pageDetails.bedrooms,
      bathrooms: pageDetails.bathrooms,
      sqft_or_acreage: pageDetails.sqft_or_acreage,
      email_received_at: receivedAt,
    })
  }

  return results
}

export async function scanGmailInbox(agentNames: string[]): Promise<{ listings: ParsedListing[]; skipped: number }> {
  const gmail = getGmailClient()

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `from:${SENDER} after:2026/06/01 before:2026/07/01`,
    maxResults: 500,
  })

  const messages = listRes.data.messages || []
  console.log(`[gmail] Found ${messages.length} emails to process`)

  const allListings: ParsedListing[] = []
  let skipped = 0

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
      if (!html) { skipped++; continue }

      const listings = await parseEmail(html, subject, receivedAt, agentNames)
      if (listings.length === 0) skipped++
      allListings.push(...listings)
    } catch (err) {
      console.error(`[gmail] Failed to parse message ${msg.id}:`, err)
      skipped++
    }
  }

  console.log(`[gmail] Parsed ${allListings.length} listing instances from ${messages.length} emails (${skipped} emails yielded no listings)`)
  return { listings: allListings, skipped }
}
