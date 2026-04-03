'use client'

import { useEffect, useRef, useState } from 'react'
import { Message } from '@/types/chat'

type Props = {
  messages: Message[]
  loading: boolean
}

type Section = {
  title: string
  content: string
  color: string
  bg: string
  icon: string
}

function parseResponse(content: string): Section[] | null {
  const sections = [
    {
      key: 'الإجابة',
      color: 'text-[#1a2d5a] dark:text-white',
      bg: 'bg-blue-50 dark:bg-white/5',
      icon: '⚖️',
    },
    {
      key: 'المواد القانونية',
      color: 'text-[#3a6ea8] dark:text-blue-300',
      bg: 'bg-blue-50/50 dark:bg-blue-900/20',
      icon: '📋',
    },
    {
      key: 'درجة الثقة',
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      icon: '📊',
    },
    {
      key: 'ملاحظة للمحامي',
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      icon: '⚠️',
    },
  ]

  const result: Section[] = []

  sections.forEach((section, i) => {
    const marker = `**${section.key}:**`
    const start = content.indexOf(marker)
    if (start === -1) return

    const contentStart = start + marker.length
    const nextSection = sections.slice(i + 1).find(s =>
      content.indexOf(`**${s.key}:**`) > start
    )
    const end = nextSection
      ? content.indexOf(`**${nextSection.key}:**`)
      : content.length

    const text = content.slice(contentStart, end).trim()

    // تجاهل "لا توجد" في ملاحظة المحامي
    if (section.key === 'ملاحظة للمحامي' &&
      (text === 'لا توجد' || text === 'لا توجد.' || text.length < 5)) return

    result.push({
      title: section.key,
      content: text,
      color: section.color,
      bg: section.bg,
      icon: section.icon,
    })
  })

  return result.length > 0 ? result : null
}

function ConfidenceBadge({ text }: { text: string }) {
  const lower = text.toLowerCase()
  const isHigh = text.includes('عالية')
  const isMed = text.includes('متوسطة')
  const color = isHigh
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    : isMed
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'

  const parts = text.split('—')
  const level = parts[0]?.trim()
  const reason = parts[1]?.trim()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${color}`}>
        {level}
      </span>
      {reason && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{reason}</span>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a2d5a] dark:hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
    >
      {copied ? '✅ تم النسخ' : '📋 نسخ'}
    </button>
  )
}

function AIMessage({ msg, index }: { msg: Message; index: number }) {
  return (
    <div
      className="flex justify-end animate-fadeIn"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl max-w-[92%] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
        
        {/* Answer */}
        <div className="px-4 py-3">
          <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>

        {/* Sources (لو موجودة) */}
        {msg.sources?.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10">
            <div className="text-xs text-gray-500 mb-1">المواد القانونية:</div>
            <div className="flex flex-wrap gap-2">
              {msg.sources.map((s: any) => (
                <span
                  key={s.id}
                  className="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs"
                >
                  مادة {s.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Copy */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-white/10 flex gap-1">
          <CopyButton text={msg.content} />
        </div>
      </div>
    </div>
  )
}

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
