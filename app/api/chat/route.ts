import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري.

مهمتك: تحليل السؤال القانوني اعتماداً فقط على النصوص المرفقة.

قواعد أساسية:
1. استخدم النصوص المرفقة فقط كمصدر قانوني.
2. إذا كانت النصوص غير كافية، صرّح بذلك بوضوح.
3. لا تختلق مواد قانونية أو أرقام مواد.

مقياس الثقة:
- عالية: النص صريح
- متوسطة: استنتاج جزئي
- منخفضة: نص غير كافي
`

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

/**
 * يحاول يستخدم Vector Search لو موجود
 */
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
  } catch (e) {
    // تجاهل أي فشل
  }

  return null
}

/**
 * Fallback search الحالي عندك
 */
function extractArticleNumbers(query: string): number[] {
  const numbers: number[] = []

  const matches = query.matchAll(/مادة\s*(\d+)/g)
  for (const m of matches) numbers.push(parseInt(m[1]))

  return [...new Set(numbers)]
}

function searchDocs(docs: any[], query: string) {
  const q = query.toLowerCase()

  // 1. Article ID search
  const articleNums = extractArticleNumbers(query)
  if (articleNums.length) {
    const byId = docs.filter(d => articleNums.includes(d.id))
    if (byId.length) return { matches: byId, mode: 'by_id' }
  }

  // 2. Keyword search
  const keyword = docs.filter(d =>
    d.keywords?.some((k: string) => q.includes(k))
  )

  if (keyword.length) {
    return { matches: keyword.slice(0, 6), mode: 'keyword' }
  }

  // 3. Text fallback
  const words = q.split(' ').filter(w => w.length > 3)

  const text = docs.filter(d =>
    words.some(w => d.text.toLowerCase().includes(w))
  )

  return {
    matches: text.slice(0, 5),
    mode: text.length ? 'text' : 'fallback',
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: 'no messages' }, { status: 400 })
    }

    const lastMessage = messages[messages.length - 1].content

    const legalDocs = loadLegalData()

    // 1. حاول Vector Search الأول
    const vectorResult = await tryVectorSearch(lastMessage)

    let matches
    let mode = 'keyword'

    if (vectorResult) {
      matches = vectorResult.matches
      mode = vectorResult.mode
    } else {
      const result = searchDocs(legalDocs, lastMessage)
      matches = result.matches
      mode = result.mode
    }

    const context = matches
      .map((d: any) => `ID: ${d.id}\nTEXT: ${d.text}`)
      .join('\n\n---\n\n')

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}

📚 النصوص القانونية:
${context}
          `,
        },
        {
          role: 'user',
          content: lastMessage,
        },
      ],
    })

    const content =
      completion.choices?.[0]?.message?.content?.trim() ||
      'لا يوجد رد'

    return NextResponse.json({
      content,
      mode,
      sources: matches.map(m => ({ id: m.id })),
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
