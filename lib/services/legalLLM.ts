import Groq from 'groq-sdk'
import type { LegalResponse } from '@/lib/types/legal'
import { SYSTEM_PROMPT } from '@/lib/constants/prompts'

// ── Strip Markdown ────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_>`-]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Parse LLM Response ────────────────────────────────────
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
      answer: stripMarkdown(parsed.answer ?? raw),
      legalSources: validSources,
      confidence: {
        level,
        reason: String(parsed.confidence?.reason ?? ''),
      },
      note:
        parsed.note && parsed.note !== 'null' ? String(parsed.note) : null,
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

// ── Main Export ───────────────────────────────────────────
export async function queryLegalLLM(
  query: string,
  context: string,
  matchedIds: number[]
): Promise<LegalResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Missing GROQ_API_KEY')

  const groq = new Groq({ apiKey })

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n📚 النصوص القانونية:\n${context}`,
      },
      { role: 'user', content: query },
    ],
  })

  const raw = completion.choices?.[0]?.message?.content?.trim() ?? ''
  return parseLLMResponse(raw, matchedIds)
}
