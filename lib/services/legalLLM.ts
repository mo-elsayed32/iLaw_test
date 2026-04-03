// lib/services/legalLLM.ts
import Groq from 'groq-sdk'
import type { LegalResponse } from '@/lib/types/legal'
import { SYSTEM_PROMPT } from '@/lib/constants/prompts'

function stripMarkdown(text: string): string { ... }
function parseLLMResponse(raw: string, matchedIds: number[]): LegalResponse { ... }

export async function queryLegalLLM(
  query: string,
  context: string,
  matchedIds: number[]
): Promise<LegalResponse> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n📚 النصوص القانونية:\n${context}` },
      { role: 'user', content: query },
    ],
  })

  const raw = completion.choices?.[0]?.message?.content?.trim() ?? ''
  return parseLLMResponse(raw, matchedIds)
}
