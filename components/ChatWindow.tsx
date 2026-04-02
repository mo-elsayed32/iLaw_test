'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/app/page'

type Props = {
  messages: Message[]
  loading: boolean
}

function parseResponse(content: string) {
  const sections = [
    { key: 'الإجابة', color: 'text-navy dark:text-white' },
    { key: 'المواد القانونية', color: 'text-navy-mid dark:text-blue-300' },
    { key: 'درجة الثقة', color: 'text-green-700 dark:text-green-400' },
    { key: 'ملاحظة للمحامي', color: 'text-orange-700 dark:text-orange-400' },
  ]

  const result: { title: string; content: string; color: string }[] = []

  sections.forEach((section, i) => {
    const start = content.indexOf(`**${section.key}:**`)
    if (start === -1) return
    const contentStart = start + section.key.length + 4
    const nextSection = sections.slice(i + 1).find(s =>
      content.indexOf(`**${s.key}:**`) > start
    )
    const end = nextSection
      ? content.indexOf(`**${nextSection.key}:**`)
      : content.length
    result.push({
      title: section.key,
      content: content.slice(contentStart, end).trim(),
      color: section.color,
    })
  })

  return result.length > 0 ? result : null
}

export default function ChatWindow({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-3 mt-32">
          <div className="text-5xl">⚖️</div>
          <h1 className="text-2xl font-bold text-navy dark:text-white">
            Hi, I'm iLaw.
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            How can I help you today?
          </p>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="bg-navy text-white px-4 py-3 rounded-[18px_18px_18px_4px] max-w-[80%]">
                {msg.content}
              </div>
            </div>
          )
        }

        const parsed = parseResponse(msg.content)

        return (
          <div key={msg.id} className="flex justify-end">
            {parsed ? (
              <div className="bg-white dark:bg-[#2d2d2d] rounded-2xl p-4 max-w-[90%] space-y-3 shadow-sm">
                {parsed.map((section) => (
                  <div key={section.title} className="border-b border-gray-100 dark:border-white/10 pb-3 last:border-0 last:pb-0">
                    <p className={`text-xs font-bold mb-1 ${section.color}`}>
                      {section.title}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                ))}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.content)}
                    className="text-xs text-gray-400 hover:text-navy"
                  >
                    📋 نسخ
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#2d2d2d] rounded-2xl px-4 py-3 max-w-[90%] text-sm text-gray-800 dark:text-gray-200">
                {msg.content}
              </div>
            )}
          </div>
        )
      })}

      {loading && (
        <div className="flex justify-end">
          <div className="bg-white dark:bg-[#2d2d2d] rounded-2xl px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-navy rounded-full animate-bounce [animation-delay:0ms]"/>
              <span className="w-2 h-2 bg-navy rounded-full animate-bounce [animation-delay:150ms]"/>
              <span className="w-2 h-2 bg-navy rounded-full animate-bounce [animation-delay:300ms]"/>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
