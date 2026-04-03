import { useEffect, useRef, useState } from 'react'
import { Message } from '@/types/chat'

type Props = {
  messages: Message[]
  loading: boolean
}

// ── Type (يطابق output الـ route) ─────────────────────────
interface LegalResponse {
  answer: string
  legalSources: number[]
  confidence: {
    level: 'high' | 'medium' | 'low'
    reason: string
  }
  note: string | null
}

// ── JSON Parser ───────────────────────────────────────────
function parseLegalResponse(content: string): LegalResponse | null {
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed.answer === 'string' && parsed.confidence) return parsed
    return null
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

// ── Structured Render ─────────────────────────────────────
function StructuredMessage({
  data,
  msg,
}: {
  data: LegalResponse
  msg: Message
}) {
  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl max-w-[92%] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">

      {/* Answer */}
      <div className="px-4 py-3 bg-blue-50 dark:bg-white/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[#1a2d5a] dark:text-blue-300">
            ⚖️ الإجابة
          </span>
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
          {data.answer}
        </p>
      </div>

      {/* Sources */}
      {msg.sources && msg.sources.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10 bg-blue-50/50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#3a6ea8] dark:text-blue-300">
              📋 المواد القانونية
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {msg.sources.map(s => (
              <span
                key={s.id}
                className="px-2 py-1 bg-white dark:bg-white/10 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-300 font-medium"
              >
                مادة {s.id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10">
        <ConfidenceBadge
          level={data.confidence.level}
          reason={data.confidence.reason}
        />
      </div>

      {/* Note */}
      {data.note && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              ⚠️ ملاحظة للمحامي
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {data.note}
          </p>
        </div>
      )}

      {/* Copy */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10">
        <CopyButton text={data.answer} />
      </div>
    </div>
  )
}

// ── Plain Text Fallback ───────────────────────────────────
function PlainMessage({ msg }: { msg: Message }) {
  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl max-w-[92%] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
      <div className="px-4 py-3">
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10">
        <CopyButton text={msg.content} />
      </div>
    </div>
  )
}

// ── AI Message Wrapper ────────────────────────────────────
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

// ── Main Component ────────────────────────────────────────
export default function ChatWindow({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-3 mt-32 animate-fadeIn">
          <div className="text-6xl animate-pulse">⚖️</div>
          <h1 className="text-2xl font-bold text-[#1a2d5a] dark:text-white">
            Hi, I'm iLaw.
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            How can I help you today?
          </p>
        </div>
      )}

      {messages.map((msg, i) => {
        if (msg.role === 'user') {
          return (
            <div
              key={msg.id}
              className="flex justify-start animate-fadeIn"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="bg-[#1a2d5a] text-white px-4 py-3 rounded-[18px_18px_18px_4px] max-w-[80%] text-sm leading-relaxed shadow-sm">
                {msg.content}
              </div>
            </div>
          )
        }
        return <AIMessage key={msg.id} msg={msg} index={i} />
      })}

      {loading && (
        <div className="flex justify-end animate-fadeIn">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl px-5 py-4 shadow-sm border border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-[#1a2d5a] dark:bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">iLaw يحلل سؤالك...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
