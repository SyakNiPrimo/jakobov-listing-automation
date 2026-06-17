import { createClient } from '@insforge/sdk'

export const db = createClient({
  baseUrl: process.env.INSFORGE_API_URL!,
  anonKey: process.env.INSFORGE_ANON_KEY!,
})
