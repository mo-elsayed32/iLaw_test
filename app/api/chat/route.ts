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

طريقة الرد:

**الإجابة:**
[تحليل قانوني مباشر وموجز — بدون مقدمات]

**المواد القانونية:**
[فقط المواد الموجودة في السياق — إن وجدت]

**ملاحظة للمحامي:**
[اكتبها فقط إذا كان هناك استثناء أو خطر فعلي يجب التنبيه عليه — وإلا اتركها فارغة تماماً]
`

function loadLegalData() {
  const filePath = path.join(process.cwd(), 'data', 'civil_code', '01_core.json')
  const file = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(file)
}

function searchDocs(docs: any[], query: string) {
  const q = query.toLowerCase()

  const exactMatches = docs.filter((doc: any) =>
    doc.text.toLowerCase().includes(q) ||
    String(doc.id) === q
  )

  const looseMatches = docs.filter((doc: any) => {
    const text = doc.text.toLowerCase()
    const keywords = q.split(' ').filter(Boolean)
    return keywords.some((k: string) => text.includes(k))
  })

  return { exactMatches, looseMatches }
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

    const groq = new Groq({ apiKey })

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
    const { exactMatches, looseMatches } = searchDocs(legalDocs, lastMessage)

    let selectedDocs: any[] = []
    let mode: 'exact' | 'loose' | 'fallback' = 'fallback'

    if (exactMatches.length > 0) {
      selectedDocs = exactMatches
      mode = 'exact'
    } else if (looseMatches.length > 0) {
      selectedDocs = looseMatches.slice(0, 5)
      mode = 'loose'
    } else {
      selectedDocs = legalDocs.slice(0, 3)
      mode = 'fallback'
    }

    const context = selectedDocs
      .map((doc: any) => `المادة ${doc.id}: ${doc.text}`)
      .join('\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n📚 النصوص المتاحة:\n${context}`,
        },
        {
          role: 'user',
          content: lastMessage,
        },
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
