// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { loadLegalData } from '@/lib/data/legalData'
import { resolveLegalSearch } from '@/lib/services/legalSearch'
import { queryLegalLLM } from '@/lib/services/legalLLM'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'no messages' }, { status: 400 })

    const query = messages[messages.length - 1].content
    const docs = loadLegalData()

    const { matches, mode } = await resolveLegalSearch(query, docs)
    const matchedIds = matches.map(m => Number(m.id))
    const context = matches.map(d => `ID: ${d.id}\nTEXT: ${d.text}`).join('\n\n---\n\n')

    const structured = await queryLegalLLM(query, context, matchedIds)

    return NextResponse.json({
      data: structured,
      mode,
      sources: structured.legalSources.map(id => ({ id: String(id) })),
      success: true,
    })
  } catch (error: any) {
    console.error('ROUTE ERROR:', error)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
