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

// ── SYSTEM PROMPT (FIXED + STRICT OUTPUT STYLE) ───────────
const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري.

⚠️ مهم جدًا: الرد يجب أن يكون JSON فقط بدون أي نص خارج JSON.

الشكل المطلوب:
{
  "answer": "النص القانوني",
  "legalSources": [101, 102],
  "confidence": {
    "level": "high | medium | low",
    "reason": "سبب التقييم"
  },
  "note": "ملاحظة أو null"
}

🚨 قواعد صارمة جدًا لكتابة answer:

1. ممنوع استخدام أي Markdown نهائيًا:
   (#, ##, -, *, **, أو أي تنسيق)

2. اكتب النص بشكل قانوني احترافي باستخدام:
   - فقرات
   - أسطر جديدة فقط
   - أو ترقيم رقمي 1، 2، 3

3. لا تستخدم عناوين Markdown إطلاقًا

4. اكتب بأسلوب قانوني واضح ومترابط

5. لو السؤال عام:
   - اشرح بتفصيل
   - قسّم الإجابة منطقيًا

6. لو السؤال محدد:
   - ركّز على الإجابة المباشرة مع شرح كافي

7. legalSources:
   - فقط من النصوص المرفقة
   - ممنوع الاختلاق

8. confidence:
   - high = نص صريح
   - medium = استنتاج
   - low = نقص معلومات
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

// ── LLM Response Parser + POST CLEANING ───────────────────
function stripMarkdown(text: string) {
  return text
    .replace(/[#*_>`-]/g, '') // remove markdown symbols
    .replace(/\n{3,}/g, '\n\n') // normalize spacing
    .trim()
}

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
      answer: stripMarkdown(parsed.answer ?? raw), // 🔥 important fix
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
      answer: stripMarkdown(raw),
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

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('Missing GROQ_API_KEY')

    const groq = new Groq({ apiKey })

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
    console.error('ROUTE ERROR:', error)

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
