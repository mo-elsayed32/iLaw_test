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

// ── SMART SYSTEM PROMPT ───────────────────────────────────
const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري.

⚠️ أعد الرد بصيغة JSON فقط — بدون أي نص خارج JSON.

الشكل المطلوب:
{
  "answer": "الإجابة القانونية",
  "legalSources": [101, 102],
  "confidence": {
    "level": "high | medium | low",
    "reason": "سبب التقييم"
  },
  "note": "ملاحظة أو null"
}

🔥 قواعد الذكاء في الإجابة:

1. طول الإجابة يعتمد على السؤال:
   - إذا السؤال عام → إجابة موسعة مفصلة (شرح + تقسيم + نقاط)
   - إذا السؤال محدد → إجابة مركزة مباشرة لكن دقيقة

2. داخل answer:
   - استخدم عناوين واضحة عند الحاجة
   - استخدم نقاط bullet points
   - اشرح المفاهيم القانونية بشكل مبسط لكن عميق
   - إذا فيه مقارنة → اشرح كل عنصر ثم الفرق

3. legalSources:
   - فقط من النصوص المرفقة
   - لا تخترع أرقام مواد

4. confidence:
   - high: نص صريح مباشر
   - medium: استنتاج منطقي
   - low: نقص معلومات

5. note:
   - اكتبها فقط لو في تحذير أو نقص معلومات
   - غير كده = null
`

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

// ── Vector Search ─────────────────────────────────────────
async function tryVectorSearch(query: string) {
  try {
    const mod = await import('@/lib/search')
    if (mod?.searchLegal) {
      const results = await mod.searchLegal(query, 5)
      if (results?.length) {
        return {
          matches: results.map((r: any) => ({
            id: r.id,
            text: r.text,
          })),
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

// ── Parser ────────────────────────────────────────────────
function parseLLMResponse(raw: string, matchedIds: number[]): LegalResponse {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    const validSources: number[] = Array.isArray(parsed.legalSources)
      ? parsed.legalSources.filter(
          (id: any) => typeof id === 'number' && matchedIds.includes(id)
        )
      : []

    const level =
      ['high', 'medium', 'low'].includes(parsed.confidence?.level)
        ? parsed.confidence.level
        : 'low'

    return {
      answer: parsed.answer ?? raw,
      legalSources: validSources,
      confidence: {
        level,
        reason: String(parsed.confidence?.reason ?? ''),
      },
      note:
        parsed.note && parsed.note !== 'null'
          ? String(parsed.note)
          : null,
    }
  } catch {
    return {
      answer: raw,
      legalSources: [],
      confidence: {
        level: 'low',
        reason: 'تعذّر تحليل الرد',
      },
      note: null,
    }
  }
}

// ── MAIN ROUTE ───────────────────────────────────────────
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

    const matchedIds = matches.map(m => Number(m.id))

    const context = matches
      .map(d => `ID: ${d.id}\nTEXT: ${d.text}`)
      .join('\n\n---\n\n')

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}

📚 النصوص القانونية:
${context}`,
        },
        { role: 'user', content: lastMessage },
      ],
    })

    const rawContent =
      completion.choices?.[0]?.message?.content?.trim() ?? ''

    const structured = parseLLMResponse(rawContent, matchedIds)

    return NextResponse.json({
      data: structured,
      mode,
      sources: structured.legalSources.map(id => ({
        id: String(id),
      })),
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
