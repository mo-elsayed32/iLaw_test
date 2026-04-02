'use client'

import { useState } from 'react'

type Props = {
  onSend: (text: string) => void
  loading: boolean
}

export default function InputBox({ onSend, loading }: Props) {
  const [text, setText] = useState('')

  const handle = () => {
    if (!text.trim() || loading) return
    onSend(text)
    setText('')
  }

  return (
    <div className="p-4">
      <div className="bg-navy dark:bg-[#2d2d2d] rounded-3xl px-4 py-3 space-y-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handle()}
          placeholder="Message iLaw..."
          className="w-full bg-transparent text-white placeholder-white/50 outline-none text-sm"
          dir="rtl"
        />
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1 px-3 py-1 rounded-full border border-white/30 text-white text-xs">
            ⚖️ Legal Research
          </button>
          <button
            onClick={handle}
            disabled={loading || !text.trim()}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center disabled:opacity-40"
          >
            <span className="text-navy font-bold text-lg">↑</span>
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        made by David Raoof
      </p>
    </div>
  )
}
