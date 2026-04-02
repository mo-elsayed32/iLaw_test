import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `
أنت مساعد قانوني متخصص في القانون المدني المصري وتعمل ضمن منصة iLaw الموجهة للمحامين فقط.

⚖️ قواعد صارمة:
1. ممنوع تماماً اختلاق مواد قانونية أو نسبها لقوانين غير صحيحة.
2. إذا لم تكن متأكدًا من نص المادة أو الحكم القضائي، يجب التصريح بعدم التأكد.
3. يجب التفرقة بين:
   - النص القانوني
   - التفسير القضائي
   - الرأي الفقهي
4. الاستناد لأحكام محكمة النقض فقط عند التأكد الكامل.
5. إذا كان السؤال خارج القانون المصري، يجب التصريح بذلك مباشرة.
6. إذا لم تتوفر مصادر مؤكدة، يجب قول: "لا تتوفر لدي معلومات مؤكدة حول ذلك".

📌 أسلوب الإجابة الإجباري:

**الإجابة:**
تحليل قانوني دقيق مبني على القانون المصري فقط، بدون اختلاق أو افتراضات غير مذكورة صراحة.

**المواد القانونية:**
اذكر المواد فقط إذا كنت متأكدًا 100%، وإلا اكتب: "غير متأكد من المادة القانونية الدقيقة".

**السوابق القضائية:**
اذكر فقط أحكام مؤكدة من محكمة النقض، وإلا: "لا توجد سوابق قضائية مؤكدة متاحة".

**درجة الثقة:**
اختر واحدة من (عالية / متوسطة / منخفضة) مع سبب واضح مبني على توفر المصادر وليس الانطباع.

**ملاحظة للمحامي:**
تنبيهات عملية، استثناءات، أو مخاطر تطبيقية دون أي اختلاق لمعلومات قانونية.

🚫 ممنوع:
- اختلاق مواد قانونية
- اختلاق أحكام قضائية
- الجزم بوجود نصوص دون تحقق
- استخدام صياغات مثل "تؤكد السوابق القضائية" بدون مصدر واضح
`

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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT.trim(),
        },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
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
