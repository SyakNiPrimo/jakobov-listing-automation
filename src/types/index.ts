export type BuildStatus = 'ready' | 'built' | 'posted' | 'error'
export type ListingStatus = 'New Listing' | 'Pending' | 'Coming Soon' | 'Closed'
export type DealSide = 'buyer' | 'seller'
export type Source = 'flexmls' | 'manual'
export type PhotoSlot = 'living_room' | 'kitchen' | 'dining_room' | 'bedroom' | 'bathroom' | 'highlight'

export interface Listing {
  id: string
  mls_number: string | null
  source: Source
  deal_side: DealSide
  address: string
  city: string
  state: string
  zip: string
  price: number | null
  status: ListingStatus
  agent_name: string
  bedrooms: number | null
  bathrooms: number | null
  sqft_or_acreage: string | null
  mls_description: string | null
  generated_caption: string | null
  is_luxury: boolean
  photo_url: string | null
  email_received_at: string | null
  build_status: BuildStatus
  canva_design_id: string | null
  canva_export_url: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  name: string
  email: string
  phone: string
  canva_headshot_asset_id: string
  instagram_handle: string | null
}

export interface ListingPhoto {
  id: string
  listing_id: string
  slot: PhotoSlot
  original_url: string
  processed_url: string | null
  created_at: string
}

export const STATUS_PRIORITY: Record<ListingStatus, number> = {
  'Closed': 4,
  'Pending': 3,
  'New Listing': 2,
  'Coming Soon': 1,
}

export const VALID_STATUSES: ListingStatus[] = ['New Listing', 'Pending', 'Coming Soon', 'Closed']

export const PHOTO_SLOTS: PhotoSlot[] = [
  'living_room', 'kitchen', 'dining_room', 'bedroom', 'bathroom', 'highlight'
]

export const PHOTO_SLOT_LABELS: Record<PhotoSlot, string> = {
  living_room: 'Living Room',
  kitchen: 'Kitchen',
  dining_room: 'Dining Room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  highlight: 'Highlight',
}
