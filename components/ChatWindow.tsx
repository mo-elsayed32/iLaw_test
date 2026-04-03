import { useEffect, useRef, useState } from 'react'
import { Message } from '@/types/chat'

type Props = {
  messages: Message[]
  loading: boolean
}

interface LegalResponse {
  answer: string
  legalSources: number[]
  confidence: {
    level: 'high' | 'medium' | 'low'
    reason: string
  }
  note: string | null
}

// ── SAFE JSON PARSER (FIXED) ─────────────────────────────
function parseLegalResponse(content: string | null | undefined): LegalResponse | null {
  if (!content || typeof content !== 'string') return null

  try {
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    if (!cleaned || cleaned === 'undefined') return null

    const parsed = JSON.parse(cleaned)

    if (!parsed || typeof parsed.answer !== 'string') return null

    return parsed
  } catch {
    return null
  }
}

// ── Confidence Badge ──────────────────────────────────────
function ConfidenceBadge({
  level,
  reason,
}: {
  level: string
  reason: string
}) {
  const config = {
    high: {
      label: 'ثقة عالية',
      color:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    medium: {
      label: 'ثقة متوسطة',
      color:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    },
    low: {
      label: 'ثقة منخفضة',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    },
  }

  const c = config[level as keyof typeof config] ?? config.low

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.color}`}>
        📊 {c.label}
      </span>
      {reason && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {reason}
        </span>
      )}
    </div>
  )
}

// ── Copy Button ───────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={() => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a2d5a] dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
    >
      {copied ? '✅ تم النسخ' : '📋 نسخ'}
    </button>
  )
}

// ── Structured Message ───────────────────────────────────
function StructuredMessage({
  data,
  msg,
}: {
  data: LegalResponse
  msg: Message
}) {
  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl max-w-[92%] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">

      <div className="px-4 py-3 bg-blue-50 dark:bg-white/5">
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {data.answer}
        </p>
      </div>

      {msg.sources?.length ? (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            {msg.sources.map(s => (
              <span key={s.id} className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30">
                مادة {s.id}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10">
        <ConfidenceBadge
          level={data.confidence.level}
          reason={data.confidence.reason}
        />
      </div>

      {data.note && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10">
          <p className="text-xs text-amber-600 dark:text-amber-300">
            {data.note}
          </p>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10">
        <CopyButton text={data.answer} />
      </div>
    </div>
  )
}

// ── Plain Message ─────────────────────────────────────────
function PlainMessage({ msg }: { msg: Message }) {
  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl max-w-[92%] p-4">
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {msg.content}
      </p>
    </div>
  )
}

// ── AI Message ────────────────────────────────────────────
function AIMessage({ msg, index }: { msg: Message; index: number }) {
  const structured = parseLegalResponse(msg.content)

  return (
    <div
      className="flex justify-end animate-fadeIn"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {structured ? (
        <StructuredMessage data={structured} msg={msg} />
      ) : (
        <PlainMessage msg={msg} />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function ChatWindow({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg, i) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="bg-[#1a2d5a] text-white px-4 py-3 rounded-lg max-w-[80%]">
                {msg.content}
              </div>
            </div>
          )
        }

        return <AIMessage key={msg.id} msg={msg} index={i} />
      })}

      {loading && (
        <div className="flex justify-end">
          <div className="text-xs text-gray-400">iLaw يحلل...</div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
