// lib/types/legal.ts

export interface LegalResponse {
  answer: string
  legalSources: number[]
  confidence: {
    level: 'high' | 'medium' | 'low'
    reason: string
  }
  note: string | null
}

export interface SearchResult {
  matches: Array<{ id: string | number; text: string }>
  mode: 'vector' | 'by_id' | 'keyword' | 'text' | 'fallback'
}
