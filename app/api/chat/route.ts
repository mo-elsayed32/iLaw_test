import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `أنت مساعد قانوني متخصص في القانون المصري تعمل ضمن منصة iLaw للمحامين.
قواعد الرد الثابتة:
١. اذكر دائماً المادة القانونية بدقة.
٢. استند لأحكام النقض المصرية إذا توافرت.
٣. نبّه للاستثناءات والحالات الخاصة.
٤. لو السؤال خارج تخصصك، وضّح ذلك واذكر الجهة المختصة.
٥. هيكل كل رد بالضبط هكذا:
**الإجابة:** [إجابة دقيقة منظمة]
**المواد القانونية:** [أمثلة: م. 172 مدني]
**درجة الثقة:** [عالية/متوسطة/منخفضة] — [سبب]
**ملاحظة للمحامي:** [تحفظ أو استثناء مهم]`

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
}
