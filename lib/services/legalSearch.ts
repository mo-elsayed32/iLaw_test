import type { SearchResult } from '@/lib/types/legal'

// ── Extract Article Numbers from query ───────────────────
function extractArticleNumbers(query: string): number[] {
  const numbers: number[] = []
  for (const m of query.matchAll(/مادة\s*(\d+)/g)) {
    numbers.push(parseInt(m[1]))
  }
  return [...new Set(numbers)]
}

// ── Fallback Text Search ──────────────────────────────────
function searchDocs(docs: any[], query: string): SearchResult {
  const q = query.toLowerCase()

  const articleNums = extractArticleNumbers(query)
  if (articleNums.length) {
    const byId = docs.filter(d => articleNums.includes(d.id))
    if (byId.length) return { matches: byId, mode: 'by_id' }
  }

  const keyword = docs.filter(d =>
    d.keywords?.some((k: string) => q.includes(k))
  )
  if (keyword.length) return { matches: keyword.slice(0, 6), mode: 'keyword' }

  const words = q.split(' ').filter(w => w.length > 3)
  const text = docs.filter(d =>
    words.some(w => d.text.toLowerCase().includes(w))
  )

  return {
    matches: text.slice(0, 5),
    mode: text.length ? 'text' : 'fallback',
  }
}

// ── Vector Search (optional) ──────────────────────────────
async function tryVectorSearch(query: string): Promise<SearchResult | null> {
  try {
    const mod = await import('@/lib/search')
    if (mod?.searchLegal) {
      const results = await mod.searchLegal(query, 5)
      if (results?.length) {
        return {
          matches: results.map((r: any) => ({ id: r.id, text: r.text })),
          mode: 'vector',
        }
      }
    }
  } catch {}
  return null
}

// ── Main Export ───────────────────────────────────────────
export async function resolveLegalSearch(
  query: string,
  docs: any[]
): Promise<SearchResult> {
  const vectorResult = await tryVectorSearch(query)
  if (vectorResult) return vectorResult
  return searchDocs(docs, query)
}
