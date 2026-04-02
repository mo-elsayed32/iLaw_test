import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري وتعمل ضمن منصة iLaw للمحامين فقط.

⚖️ قواعد صارمة:
- ممنوع اختلاق أي مواد قانونية أو أحكام قضائية.
- يجب الاعتماد فقط على النصوص القانونية المتوفرة في السياق.
- إذا لم توجد مادة مباشرة: لا تتوقف عن الإجابة، بل وضّح الإطار القانوني الأقرب بشرط عدم اختلاق مواد.
- لا تقدم أي معلومة غير مدعومة بالنصوص أو القواعد العامة المستقرة.

📌 أسلوب الإجابة:

**الإجابة:**
تحليل قانوني دقيق.

**الإطار القانوني:**
حدد ما إذا كان هناك نص مباشر أو قواعد عامة فقط.

**المواد القانونية:**
اذكر فقط المواد الموجودة في السياق.

**ملاحظة للمحامي:**
توضيح مهني مختصر + درجة يقين التحليل.
`

function loadLegalData() {
  const filePath = path.join(process.cwd(), 'data', 'civil_code.json')
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

    // ✅ إنشاء Groq هنا (مش بره)
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
          content: `
${SYSTEM_PROMPT}

📊 وضع الاسترجاع الحالي: ${mode.toUpperCase()}

📚 النصوص القانونية المتاحة:
${context}
          `.trim(),
        },
        {
          role: 'user',
          content: lastMessage,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    })

    const content =
      completion.choices?.[0]?.message?.content?.trim() ||
      'لم يتم الحصول على رد.'

    return NextResponse.json({
      content,
      mode,
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
