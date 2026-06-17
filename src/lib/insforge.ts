const INSFORGE_API_URL = process.env.INSFORGE_API_URL!
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY!

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${INSFORGE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INSFORGE_API_KEY}`,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`InsForge ${options.method || 'GET'} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export const db = {
  from(table: string) {
    return new QueryBuilder(table)
  },
}

class QueryBuilder {
  private table: string
  private filters: string[] = []
  private selectCols = '*'
  private orderCol?: string
  private orderDir: 'asc' | 'desc' = 'asc'
  private limitVal?: number

  constructor(table: string) {
    this.table = table
  }

  select(cols: string) {
    this.selectCols = cols
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push(`${col}=eq.${val}`)
    return this
  }

  in(col: string, vals: unknown[]) {
    this.filters.push(`${col}=in.(${vals.join(',')})`)
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col
    this.orderDir = opts?.ascending === false ? 'desc' : 'asc'
    return this
  }

  limit(n: number) {
    this.limitVal = n
    return this
  }

  private buildQuery() {
    const params = new URLSearchParams()
    if (this.selectCols !== '*') params.set('select', this.selectCols)
    this.filters.forEach(f => {
      const [k, v] = f.split('=')
      params.append(k, v)
    })
    if (this.orderCol) params.set('order', `${this.orderCol}.${this.orderDir}`)
    if (this.limitVal) params.set('limit', String(this.limitVal))
    const q = params.toString()
    return `/${this.table}${q ? '?' + q : ''}`
  }

  async get(): Promise<{ data: unknown[]; error: Error | null }> {
    try {
      const data = await request(this.buildQuery())
      return { data, error: null }
    } catch (error) {
      return { data: [], error: error as Error }
    }
  }

  async insert(record: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> {
    try {
      const data = await request(`/${this.table}`, {
        method: 'POST',
        body: JSON.stringify(record),
      })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async upsert(record: Record<string, unknown>, onConflict?: string): Promise<{ data: unknown; error: Error | null }> {
    try {
      const path = onConflict
        ? `/${this.table}?on_conflict=${onConflict}`
        : `/${this.table}`
      const data = await request(path, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(record),
      })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async update(record: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> {
    try {
      const data = await request(this.buildQuery(), {
        method: 'PATCH',
        body: JSON.stringify(record),
      })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  async delete(): Promise<{ error: Error | null }> {
    try {
      await request(this.buildQuery(), { method: 'DELETE' })
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }
}
