import Anthropic from '@anthropic-ai/sdk'
import { DealSide, ListingStatus } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface CaptionInput {
  address: string
  city: string
  state: string
  status: ListingStatus
  deal_side: DealSide
  agent_name: string
  agent_instagram: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft_or_acreage: string | null
  price: number | null
  mls_description: string | null
}

function openerLine(status: ListingStatus, city: string): string {
  const map: Record<ListingStatus, string> = {
    'New Listing': `✨ New Listing in ${city}`,
    'Coming Soon': `✨ Coming Soon in ${city}`,
    'Pending': `✨ Pending in ${city}`,
    'Closed': `✨ Closed in ${city}`,
  }
  return map[status]
}

function creditLine(deal_side: DealSide, status: ListingStatus, agent_instagram: string | null): string {
  const handle = agent_instagram ? `@${agent_instagram.replace(/^@/, '')}` : '@thejakobovgroup'
  if (deal_side === 'buyer') {
    return `Buyer represented by: ${handle} + @thejakobovgroup`
  }
  if (status === 'Closed') {
    return `Sold by: ${handle} + @thejakobovgroup`
  }
  return `Listed by: ${handle} + @thejakobovgroup`
}

function hashtagLine(status: ListingStatus, city: string): string {
  const statusTag: Record<ListingStatus, string> = {
    'New Listing': '#NewListing',
    'Coming Soon': '#ComingSoon',
    'Pending': '#Pending',
    'Closed': '#Closed',
  }
  const cityTag = `#${city.replace(/\s+/g, '')}AZ`
  return `#Arizona #RealEstate #TheJakobovGroup ${cityTag} ${statusTag[status]}`
}

export async function generateCaption(input: CaptionInput): Promise<string> {
  const {
    address, city, state, status, deal_side, agent_name,
    agent_instagram, bedrooms, bathrooms, sqft_or_acreage, price, mls_description,
  } = input

  const priceStr = price ? `$${price.toLocaleString()}` : 'Price not listed'

  const prompt = `You are a copywriter for The Jakobov Group, a luxury real estate team in Arizona. Write an Instagram caption for a property.

Style rules:
- Two original paragraphs informed by the MLS description's facts. Do NOT closely mirror the MLS description's sentence structure or copy phrases verbatim. Write fresh, editorial copy.
- Do NOT use em dashes or hyphens anywhere in the caption. Use semicolons, periods, or "and" instead when joining clauses.
- Tone: premium, editorial, minimal. Not generic SaaS marketing copy.
- Do not use exclamation points.

Property details:
- Address: ${address}
- City: ${city}, ${state}
- Status: ${status}
- Deal side: ${deal_side}
- Agent: ${agent_name}
- Bedrooms: ${bedrooms ?? 'N/A'}
- Bathrooms: ${bathrooms ?? 'N/A'}
- Size: ${sqft_or_acreage ?? 'N/A'}
- Price: ${priceStr}
- MLS Description: ${mls_description || 'Not provided'}

Output ONLY the two descriptive paragraphs (no opener, no hashtags, no credit line, no labels). Paragraphs should be separated by a blank line.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const bodyText = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  const opener = openerLine(status, city)
  const details = [
    `📍 ${address}`,
    bedrooms != null ? `🛏️ ${bedrooms} Bedrooms` : null,
    bathrooms != null ? `🛁 ${bathrooms} Bathrooms` : null,
    sqft_or_acreage ? `📐 ${sqft_or_acreage}` : null,
    `💲 ${priceStr}`,
  ].filter(Boolean).join('\n')

  const credit = creditLine(deal_side, status, agent_instagram)
  const hashtags = hashtagLine(status, city)

  return [opener, '', bodyText, '', details, '', credit, '', hashtags].join('\n')
}
