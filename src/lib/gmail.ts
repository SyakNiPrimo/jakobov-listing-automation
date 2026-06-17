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

function extractPlainBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data)
  }
  for (const part of payload.parts || []) {
    const text = extractPlainBody(part)
    if (text) return text
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

async function tryFetchHighResPhoto(listingPageUrl: string, fallback: string | null): Promise<string | null> {
  try {
    const res = await fetch(listingPageUrl, { signal: AbortSignal.timeout(8000) })
    const html = await res.text()
    const $ = cheerio.load(html)
    const candidates: string[] = []
    $('img[src*="cdn.photos.sparkplatform.com"]').each((_, el) => {
      const src = $(el).attr('src')
      if (src) candidates.push(src)
    })
    // prefer larger images (look for size hints in URL)
    const hd = candidates.find(u => /\d{4,}x\d{4,}|large|full|hd/i.test(u))
    return hd || candidates[0] || fallback
  } catch {
    return fallback
  }
}

export async function parseEmail(
  subject: string,
  html: string,
  plain: string,
  receivedAt: Date,
  agentNames: string[],
): Promise<ParsedListing> {
  const combined = subject + ' ' + html + ' ' + plain

  // MLS number
  const mlsMatch = combined.match(/#(\d{6,})/i)
  const mls_number = mlsMatch ? mlsMatch[1] : null

  // Status
  let status: ListingStatus | null = null
  let bestPriority = -1
  for (const s of VALID_STATUSES) {
    if (new RegExp(s, 'i').test(combined)) {
      if (STATUS_PRIORITY[s] > bestPriority) {
        bestPriority = STATUS_PRIORITY[s]
        status = s
      }
    }
  }

  // Price
  const priceMatch = combined.match(/\$\s?([\d,]+)/)
  const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null

  // Address — look for typical US address pattern
  const addressMatch = combined.match(/(\d+\s+[\w\s.#-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Blvd|Boulevard|Way|Court|Ct|Place|Pl|Circle|Cir|Trail|Trl)\s+[\w\s]+,\s*[A-Z]{2}\s+\d{5})/i)
  let address: string | null = null
  let city: string | null = null
  let state: string | null = null
  let zip: string | null = null
  if (addressMatch) {
    const raw = addressMatch[1].trim()
    const parts = raw.split(',')
    if (parts.length >= 2) {
      address = parts[0].trim()
      const cityStatePart = parts.slice(1).join(',').trim()
      const stateZipMatch = cityStatePart.match(/^(.*?)\s+([A-Z]{2})\s+(\d{5})$/)
      if (stateZipMatch) {
        city = stateZipMatch[1].trim()
        state = stateZipMatch[2]
        zip = stateZipMatch[3]
      }
    }
  }

  // Agent name — match against known agents
  let agent_name: string | null = null
  for (const name of agentNames) {
    if (combined.toLowerCase().includes(name.toLowerCase())) {
      agent_name = name
      break
    }
  }

  // Photo URL
  const $ = cheerio.load(html)
  let photo_url: string | null = null
  $('img[src*="cdn.photos.sparkplatform.com"]').each((_, el) => {
    if (!photo_url) photo_url = $(el).attr('src') || null
  })

  // Try to get high-res from listing page
  const viewListingLink = $('a').filter((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().toLowerCase()
    return text.includes('view') && text.includes('listing') && href.startsWith('http')
  }).first().attr('href') || null

  if (viewListingLink) {
    photo_url = await tryFetchHighResPhoto(viewListingLink, photo_url)
  }

  return {
    mls_number,
    status,
    price,
    address,
    city,
    state,
    zip,
    agent_name,
    photo_url,
    email_received_at: receivedAt,
  }
}

export async function scanGmailInbox(agentNames: string[]): Promise<ParsedListing[]> {
  const gmail = getGmailClient()

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `from:${SENDER}`,
    maxResults: 200,
  })

  const messages = listRes.data.messages || []
  const results: ParsedListing[] = []

  for (const msg of messages) {
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
    const plain = extractPlainBody(payload)

    const parsed = await parseEmail(subject, html, plain, receivedAt, agentNames)
    if (parsed.status) {
      results.push(parsed)
    }
  }

  return results
}
