import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري، تعمل ضمن منصة iLaw للمحامين.

قواعد صارمة:
- ممنوع اختلاق أي مواد قانونية أو أحكام قضائية.
- اعتمد فقط على النصوص الموجودة في السياق.
- إذا لم توجد مادة مباشرة: أجب بالإطار القانوني الأقرب دون اختلاق.

طريقة الرد — اتبع هذا الهيكل حرفياً:

**الإجابة:**
[تحليل قانوني مباشر وموجز]

**المواد القانونية:**
[فقط المواد الموجودة في السياق المرفق — اذكر رقمها ونصها]

**درجة الثقة:**
[عالية / متوسطة / منخفضة] — [سبب مختصر جداً: مثلاً "نص صريح في المادة 163" أو "استنتاج من مبادئ عامة"]

**ملاحظة للمحامي:**
[اكتبها فقط إذا كان هناك استثناء أو خطر فعلي — وإلا اكتب: لا توجد]
`

let cachedDocs: any[] | null = null

function loadLegalData() {
  if (cachedDocs) return cachedDocs
  const filePath = path.join(process.cwd(), 'data', 'civil_code', 'civil_full.json')
  const file = fs.readFileSync(filePath, 'utf-8')
  cachedDocs = JSON.parse(file)
  return cachedDocs
}

function extractArticleNumbers(query: string): number[] {
  const numbers: number[] = []

  // أرقام إنجليزية: "المادة 105" أو "مادة 105"
  const enMatches = query.matchAll(/مادة\s*(\d+)/g)
  for (const m of enMatches) numbers.push(parseInt(m[1]))

  // أرقام عربية: "المادة ١٠٥"
  const arMap: Record<string, string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4',
    '٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
  }
  const arMatches = query.matchAll(/مادة\s*([٠-٩]+)/g)
  for (const m of arMatches) {
    const converted = m[1].split('').map(c => arMap[c] || c).join('')
    numbers.push(parseInt(converted))
  }

  // أرقام مجردة مع سياق: "105 مدني" أو "م. 105"
  const shortMatches = query.matchAll(/م[.\s]+(\d+)/g)
  for (const m of shortMatches) numbers.push(parseInt(m[1]))

  return [...new Set(numbers)]
}

function searchDocs(docs: any[], query: string) {
  const q = query.toLowerCase()

  // ١. بحث برقم المادة مباشرة
  const articleNums = extractArticleNumbers(query)
  if (articleNums.length > 0) {
    const byId = docs.filter(doc => articleNums.includes(doc.id))
    if (byId.length > 0) return { matches: byId, mode: 'by_id' as const }
  }

  // ٢. بحث بالكلمات المفتاحية
  const keywords = docs.filter(doc =>
    doc.keywords?.some((kw: string) => q.includes(kw))
  )
  if (keywords.length > 0) return { matches: keywords.slice(0, 6), mode: 'keyword' as const }

  // ٣. بحث نصي
  const words = q.split(' ').filter(w => w.length > 3)
  const textMatch = docs.filter(doc => {
    const text = doc.text.toLowerCase()
    return words.some(w => text.includes(w))
  })
  if (textMatch.length > 0) return { matches: textMatch.slice(0, 5), mode: 'text' as const }

  // ٤. fallback
  return { matches: docs.slice(0, 3), mode: 'fallback' as const }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY غير موجود' }, { status: 500 })
    }

    const groq = new Groq({ apiKey })
    const body = await req.json()
    const messages = body?.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'لا توجد رسائل صالحة' }, { status: 400 })
    }

    const lastMessage = messages[messages.length - 1]?.content || ''
    const legalDocs = loadLegalData()
    const { matches, mode } = searchDocs(legalDocs!, lastMessage)

    const context = matches
      .map((doc: any) => `المادة ${doc.id}: ${doc.text}`)
      .join('\n\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n📚 النصوص القانونية المتاحة:\n${context}`,
        },
        { role: 'user', content: lastMessage },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    const content =
      completion.choices?.[0]?.message?.content?.trim() ||
      'لم يتم الحصول على رد.'

    return NextResponse.json({ content, mode, success: true })

  } catch (error: any) {
    console.error('Groq API Error:', error)
    return NextResponse.json(
      {
        error: 'حدث خطأ في الاتصال بالذكاء الاصطناعي',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
