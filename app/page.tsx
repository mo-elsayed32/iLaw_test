'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import InputBox from '@/components/InputBox'
import type { Message } from '@/types/chat'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [dark, setDark] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    }

    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })

      const data = await res.json()

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        sources: data.sources ?? [],
      }

      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'حدث خطأ، يرجى المحاولة مرة أخرى.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="flex h-screen bg-bg-light dark:bg-[#1a1a1a]">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          dark={dark}
          setDark={setDark}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 right-4 z-10 text-navy dark:text-white"
          >
            ☰
          </button>

          <ChatWindow messages={messages} loading={loading} />
          <InputBox onSend={sendMessage} loading={loading} />
        </div>
      </div>
    </div>
  )
}
