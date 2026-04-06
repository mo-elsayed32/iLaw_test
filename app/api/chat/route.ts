import { NextRequest, NextResponse } from 'next/server'
import { loadLegalData } from '@/lib/data/legalData'
import { resolveLegalSearch } from '@/lib/services/legalSearch'
import { queryLegalLLM } from '@/lib/services/legalLLM'
import { AppError } from '@/lib/types/errors'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages?.length) {
      throw new AppError('INVALID_REQUEST', 'no messages provided')
    }

    const query = messages[messages.length - 1].content

    if (!query?.trim()) {
      throw new AppError('INVALID_REQUEST', 'empty query')
    }

    let docs
    try {
      docs = loadLegalData()
    } catch (e) {
      throw new AppError('DATA_LOAD_ERROR', String(e))
    }

    let searchResult
    try {
      searchResult = await resolveLegalSearch(query, docs)
    } catch (e) {
      throw new AppError('SEARCH_ERROR', String(e))
    }

    const { matches, mode } = searchResult
    const matchedIds = matches.map(m => Number(m.id))
    const context = matches
      .map(d => `ID: ${d.id}\nTEXT: ${d.text}`)
      .join('\n\n---\n\n')

    let structured
    try {
      structured = await queryLegalLLM(query, context, matchedIds, messages)
    } catch (e) {
      throw new AppError('LLM_ERROR', String(e))
    }

    return NextResponse.json({
      data: structured,
      mode,
      sources: structured.legalSources.map(id => ({ id: String(id) })),
      success: true,
    })

  } catch (error: any) {
    console.error('ROUTE ERROR:', error)

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          errorCode: error.code,
          userMessage: error.userMessage,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        errorCode: 'UNKNOWN_ERROR',
        userMessage: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      },
      { status: 500 }
    )
  }
}
