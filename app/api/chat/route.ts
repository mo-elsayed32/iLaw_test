import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

// ── Types ─────────────────────────────────────────────────
interface LegalResponse {
  answer: string
  legalSources: number[]
  confidence: {
    level: 'high' | 'medium' | 'low'
    reason: string
  }
  note: string | null
}

// ── System Prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `أنت مساعد قانوني متخصص في القانون المدني المصري.
مهمتك: تحليل السؤال القانوني اعتماداً فقط على النصوص المرفقة.

⚠️ أعد الرد بصيغة JSON فقط — لا تضف أي نص خارج الـ JSON أبداً.

الشكل المطلوب حرفياً:
{
  "answer": "الإجابة القانونية الكاملة",
  "legalSources": [101, 102],
  "confidence": {
    "level": "high",
    "reason": "سبب درجة الثقة"
  },
  "note": "ملاحظة إضافية أو null"
}

مقياس الثقة:
- high: النص القانوني صريح ومباشر
- medium: استنتاج جزئي من النصوص
- low: النصوص غير كافية للإجابة

قواعد صارمة:
1. legalSources: أرقام المواد من النصوص المرفقة فقط — لا تخترع أرقاماً
2. إذا كانت النصوص غير كافية، اكتب ذلك في answer وضع level: "low"
3. note يكون null إذا لم يكن هناك ملاحظة مهمة`

// ── Data Loading ──────────────────────────────────────────
let cachedDocs: any[] | null = null

function loadLegalData() {
  if (cachedDocs) return cachedDocs
  const filePath = path.join(
    process.cwd(),
    'data',
    'civil_code',
    'civil_full.json'
  )
  cachedDocs = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return cachedDocs
}

// ── Vector Search (optional) ──────────────────────────────
async function tryVectorSearch(query: string) {
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

// ── Fallback Search ───────────────────────────────────────
function extractArticleNumbers(query: string): number[] {
  const numbers: number[] = []
  for (const m of query.matchAll(/مادة\s*(\d+)/g)) {
    numbers.push(parseInt(m[1]))
  }
  return [...new Set(numbers)]
}

function searchDocs(docs: any[], query: string) {
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

// ── LLM Response Parser ───────────────────────────────────
function parseLLMResponse(raw: string, matchedIds: number[]): LegalResponse {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (typeof parsed.answer !== 'string') throw new Error('missing answer')

    const validSources: number[] = Array.isArray(parsed.legalSources)
      ? parsed.legalSources.filter(
          (id: any) => typeof id === 'number' && matchedIds.includes(id)
        )
      : []

    const level = ['high', 'medium', 'low'].includes(parsed.confidence?.level)
      ? (parsed.confidence.level as 'high' | 'medium' | 'low')
      : 'low'

    return {
      answer: parsed.answer,
      legalSources: validSources,
      confidence: {
        level,
        reason: String(parsed.confidence?.reason ?? ''),
      },
      note:
        parsed.note && parsed.note !== 'null' && parsed.note !== null
          ? String(parsed.note)
          : null,
    }
  } catch {
    return {
      answer: raw,
      legalSources: [],
      confidence: { level: 'low', reason: 'تعذّر تحليل الرد' },
      note: null,
    }
  }
}

// ── Main Handler ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: 'no messages' }, { status: 400 })
    }

    const lastMessage = messages[messages.length - 1].content
    const legalDocs = loadLegalData()

    const vectorResult = await tryVectorSearch(lastMessage)
    let matches: any[]
    let mode: string

    if (vectorResult) {
      matches = vectorResult.matches
      mode = vectorResult.mode
    } else {
      const result = searchDocs(legalDocs, lastMessage)
      matches = result.matches
      mode = result.mode
    }

    const matchedIds = matches.map((m: any) => Number(m.id))

    const context = matches
      .map((d: any) => `ID: ${d.id}\nTEXT: ${d.text}`)
      .join('\n\n---\n\n')

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n📚 النصوص القانونية المرفقة:\n${context}`,
        },
        { role: 'user', content: lastMessage },
      ],
    })

    const rawContent =
      completion.choices?.[0]?.message?.content?.trim() ?? ''

    const structured = parseLLMResponse(rawContent, matchedIds)

    return NextResponse.json({
      content: JSON.stringify(structured),
      mode,
      sources: structured.legalSources.map(id => ({ id: String(id) })),
      success: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'server error',
        details:
          process.env.NODE_ENV === 'development'
            ? error?.message
            : undefined,
      },
      { status: 500 }
    )
  }
}
