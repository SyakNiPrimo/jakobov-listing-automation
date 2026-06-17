/**
 * Run with: npx tsx scripts/seed.ts
 * Requires INSFORGE_API_URL and INSFORGE_API_KEY in environment.
 */

import { v4 as uuidv4 } from 'uuid'

const API_URL = process.env.INSFORGE_API_URL!
const API_KEY = process.env.INSFORGE_API_KEY!

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

const agents = [
  { name: 'Ari Jakobov', email: 'ari@jakobovgroup.com', phone: '(602) 500-9874', instagram_handle: '@ari.jakobov' },
  { name: 'Alijah Thomas', email: 'alijah@jakobovgroup.com', phone: '(480) 589-1885', instagram_handle: '@alijahazrealtor' },
  { name: 'Angela Sinagoga', email: 'angela@jakobovgroup.com', phone: '(480) 231-9888', instagram_handle: '@azbootsrealtor' },
  { name: 'Brandon Uribe', email: 'brandon@jakobovgroup.com', phone: '(480) 686-3497', instagram_handle: '@brandonsoldmyhome' },
  { name: 'Catherine Gurevich', email: 'catherine@jakobovgroup.com', phone: '(480) 717-8557', instagram_handle: '@catherine.azrealtor' },
  { name: 'Evelyn Galibova', email: 'evelyngalibov@gmail.com', phone: '(602) 384-7540', instagram_handle: '@evelyngalibov' },
  { name: 'Giselle Gutierrez', email: 'Giselle@jakobovgroup.com', phone: '(602) 803-0276', instagram_handle: '@gisellleneblina' },
  { name: 'James Mandavia', email: 'james@jakobovgroup.com', phone: '(623) 760-5100', instagram_handle: '@james_mandavia.realtor' },
  { name: 'Joe Babadzhanov', email: 'josef@jakobovgroup.com', phone: '(602) 718-5296', instagram_handle: '@josefbabadzhanov' },
  { name: 'John Ilyayev', email: 'john@jakobovgroup.com', phone: '(602) 570-8307', instagram_handle: '@johnsellsarizona' },
  { name: 'Katelyn Bullan', email: 'katelyn@jakobovgroup.com', phone: '(602) 607-0457', instagram_handle: '@katelynbullan.realtor' },
  { name: 'Katherine Ortmeier', email: 'katherine@jakobovgroup.com', phone: '(785) 215-5202', instagram_handle: '@kath_ortmeier' },
  { name: 'Kelly Bridges', email: 'kelly@jakobovgroup.com', phone: '(480) 980-7198', instagram_handle: '@kmbridges' },
  { name: 'Nikita Salazar', email: 'nikita@jakobovgroup.com', phone: '(951) 923-3067', instagram_handle: '@nikita_salazar_az_realtor' },
  { name: 'Roxy Rodriguez', email: 'roxy@jakobovgroup.com', phone: '(623) 224-7973', instagram_handle: '@roxyazrealtor' },
  { name: 'Samuel Negreanu', email: 'samuel@jakobovgroup.com', phone: '(602) 904-3045', instagram_handle: '@sold.by.samy' },
  { name: 'Shayna Moos', email: 'shayna@jakobovgroup.com', phone: '(480) 818-0182', instagram_handle: '@shaynanigens' },
  { name: 'Steele Nash', email: 'steele@jakobovgroup.com', phone: '(602) 345-0515', instagram_handle: '@azrealtorsteele' },
  { name: 'Stephanie Pieper', email: 'stephanie@jakobovgroup.com', phone: '(602) 391-4408', instagram_handle: '@peppptalk_arizonarealtor' },
  { name: 'Svetlana Suleymanov', email: 'Svetlanasuleymanov@gmail.com', phone: '(602) 486-3313', instagram_handle: '@svetlanasuleymanov' },
  { name: 'Teddy Kieborz', email: 'Theodore@jakobovgroup.com', phone: '(602) 383-4007', instagram_handle: '@teddysellsaz' },
]

async function seed() {
  console.log(`Seeding ${agents.length} agents…`)
  for (const agent of agents) {
    await post('/agents', {
      id: uuidv4(),
      ...agent,
      canva_headshot_asset_id: '',
    })
    console.log(`  ✓ ${agent.name}`)
  }
  console.log('Seed complete.')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
