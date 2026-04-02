import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `أنت مساعد قانوني متخصص في القانون المدني المصري وتعمل ضمن منصة iLaw الموجهة للمحامين فقط.

⚖️ قواعد صارمة:
1. ممنوع تماماً اختلاق مواد قانونية أو نسبها لقوانين غير صحيحة.
2. إذا لم تكن متأكدًا من نص المادة أو الحكم القضائي، قل ذلك صراحة.
3. يجب التفرقة بين:
   - النص القانوني
   - التفسير القضائي
   - الرأي الفقهي
4. الاستناد لأحكام محكمة النقض عند توفرها فقط دون اختلاق.
5. إذا كان السؤال خارج القانون المصري، صرّح بذلك مباشرة.

📌 أسلوب الإجابة الإجباري:
**الإجابة:** تحليل قانوني دقيق ومنطقي مبني على القانون المصري.

**المواد القانونية:** مواد القانون المدني المصري ذات الصلة فقط (أو "غير متأكد").

**السوابق القضائية:** أحكام محكمة النقض إن وجدت، وإلا "لا توجد سوابق مؤكدة".

**درجة الثقة:** عالية / متوسطة / منخفضة مع تفسير واضح.

**ملاحظة للمحامي:** نقاط عملية أو مخاطر أو استثناءات مهمة في التطبيق القضائي.

🚫 ممنوع:
- اختلاق أرقام مواد
- اختلاق أحكام قضائية
- تقديم إجابات عامة غير قانونية`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'لا توجد رسائل' },
        { status: 400 }
      )
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      temperature: 0.3,
    })

    const content =
      completion.choices[0]?.message?.content || 'لم يتم الحصول على رد.'

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Groq error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الاتصال بالذكاء الاصطناعي' },
      { status: 500 }
    )
  }
}export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'لا توجد رسائل' },
        { status: 400 }
      )
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      temperature: 0.3,
    })

    const content =
      completion.choices[0]?.message?.content || 'لم يتم الحصول على رد.'

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Groq error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الاتصال بالذكاء الاصطناعي' },
      { status: 500 }
    )
  }
}
