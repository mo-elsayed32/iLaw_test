import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري.

مهمتك: تحليل السؤال القانوني اعتماداً فقط على النصوص المرفقة.

قواعد أساسية:
1. استخدم النصوص المرفقة فقط كمصدر قانوني.
2. إذا كانت النصوص غير كافية، صرّح بذلك بوضوح ولا تكمل استنتاجات قانونية حاسمة.
3. يمكنك تقديم تحليل قانوني منطقي فقط إذا كان مدعوماً جزئياً بالنصوص.
4. لا تختلق مواد قانونية أو أرقام مواد.

أسلوب الإجابة:
- تحليل قانوني مباشر وواضح.
- ذكر المواد ذات الصلة فقط إذا كانت موجودة فعلاً.
- تحديد درجة الثقة بناءً على وضوح النصوص.

مقياس الثقة:
- عالية: النص صريح ومباشر
- متوسطة: استنتاج مدعوم جزئياً
- منخفضة: النصوص غير كافية لكن يوجد إطار عام

مهم جداً:
إذا لم توجد نصوص كافية →
قل حرفياً: "لا توجد نصوص قانونية كافية ضمن قاعدة البيانات الحالية للإجابة الدقيقة"
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

  const file = fs.readFileSync(filePath, 'utf-8')
  cachedDocs = JSON.parse(file)

  return cachedDocs
}

function extractArticleNumbers(query: string): number[] {
  const numbers: number[] = []

  const enMatches = query.matchAll(/مادة\s*(\d+)/g)
  for (const m of enMatches) {
    numbers.push(parseInt(m[1]))
  }

  const arMap: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  }

  const arMatches = query.matchAll(/مادة\s*([٠-٩]+)/g)
  for (const m of arMatches) {
    const converted = m[1]
      .split('')
      .map((c) => arMap[c] || c)
      .join('')

    numbers.push(parseInt(converted))
  }

  const shortMatches = query.matchAll(/م[.\s]+(\d+)/g)
  for (const m of shortMatches) {
    numbers.push(parseInt(m[1]))
  }

  return [...new Set(numbers)]
}

function searchDocs(docs: any[], query: string) {
  const q = query.toLowerCase()

  // 1. Article ID search (highest priority)
  const articleNums = extractArticleNumbers(query)
  if (articleNums.length > 0) {
    const byId = docs.filter((doc) => articleNums.includes(doc.id))
    if (byId.length > 0) {
      return { matches: byId, mode: 'by_id' as const }
    }
  }

  // 2. Keyword search
  const keywords = docs.filter((doc) =>
    doc.keywords?.some((kw: string) => q.includes(kw))
  )

  if (keywords.length > 0) {
    return { matches: keywords.slice(0, 6), mode: 'keyword' as const }
  }

  // 3. Text search fallback
  const words = q.split(' ').filter((w) => w.length > 3)

  const textMatch = docs.filter((doc) => {
    const text = doc.text.toLowerCase()
    return words.some((w) => text.includes(w))
  })

  if (textMatch.length > 0) {
    return { matches: textMatch.slice(0, 5), mode: 'text' as const }
  }

  // 4. Last fallback
  return { matches: docs.slice(0, 3), mode: 'fallback' as const }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY غير موجود' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const messages = body?.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'لا توجد رسائل صالحة' },
        { status: 400 }
      )
    }

    const lastMessage = messages[messages.length - 1]?.content || ''

    const legalDocs = loadLegalData()
    const { matches, mode } = searchDocs(legalDocs!, lastMessage)

    const context = matches
      .map((doc: any) => {
        return `ID: ${doc.id}\nTEXT: ${doc.text}`
      })
      .join('\n\n---\n\n')

    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}

📚 النصوص القانونية المتاحة:
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
      'لم يتم الحصول على رد.'

    return NextResponse.json({
      content,
      mode,
      sources: matches.map((m) => ({
        id: m.id,
      })),
      success: true,
    })
  } catch (error: any) {
    console.error('Groq API Error:', error)

    return NextResponse.json(
      {
        error: 'حدث خطأ في الاتصال بالذكاء الاصطناعي',
        details:
          process.env.NODE_ENV === 'development'
            ? error?.message
            : undefined,
      },
      { status: 500 }
    )
  }
}
