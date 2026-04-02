import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري وتعمل ضمن منصة iLaw للمحامين فقط.

⚖️ قواعد صارمة:
- ممنوع اختلاق أي مواد قانونية أو أحكام قضائية.
- يجب الاعتماد فقط على النصوص القانونية المتوفرة لك في السياق.
- إذا لم تجد إجابة في النصوص: قل "لا توجد مادة قانونية داعمة في قاعدة البيانات".
- لا تقدم أي معلومة غير موجودة في النصوص.

📌 أسلوب الإجابة:

**الإجابة:**
تحليل قانوني مبني فقط على النصوص المتاحة.

**المواد القانونية:**
اذكر فقط المواد الموجودة في النص.

**ملاحظة للمحامي:**
تنبيه عملي بدون أي إضافة غير موجودة في المصدر.
`

// 🧠 تحميل ملف القانون
function loadLegalData() {
  const filePath = path.join(process.cwd(), 'data', 'civil_code.json')
  const file = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(file)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages = body?.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'لا توجد رسائل صالحة' },
        { status: 400 }
      )
    }

    // 🧠 آخر سؤال من المستخدم
    const lastMessage = messages[messages.length - 1]?.content || ''

    // 📚 تحميل القانون
    const legalDocs = loadLegalData()

    const query = lastMessage.toLowerCase()

const filteredDocs = legalDocs.filter((doc: any) =>
  doc.text.toLowerCase().includes(query) ||
  query.includes(String(doc.id))
)

// لو مفيش نتائج، خد أهم مواد (fallback)
const selectedDocs =
  filteredDocs.length > 0 ? filteredDocs : legalDocs.slice(0, 3)

const context = selectedDocs
  .map((doc: any) => `المادة ${doc.id}: ${doc.text}`)
  .join('\n')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}

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
