'use client'

type Props = {
  open: boolean
  onClose: () => void
  dark: boolean
  setDark: (v: boolean) => void
}

export default function Sidebar({ open, onClose, dark, setDark }: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-full w-72 z-30
          bg-navy dark:bg-[#111111] text-white
          transform transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <span className="text-lg font-bold">iLaw AI Chat</span>
          <button onClick={onClose} className="text-white text-xl">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <button className="w-full text-right px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-2">
            <span>⚖️</span>
            <span>Legal Research</span>
          </button>
          <button className="w-full text-right px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-2">
            <span>🎓</span>
            <span>Exams</span>
          </button>
          <button className="w-full text-right px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-2">
            <span>💬</span>
            <span>New Chat</span>
          </button>
        </div>

        <div className="p-4">
          <p className="text-white/50 text-sm mb-2">Recents</p>
          <p className="text-white/30 text-xs">لا توجد محادثات سابقة</p>
        </div>

        <div className="absolute bottom-4 right-4 left-4">
          <div className="rounded-2xl border border-white/20 p-3">
            <p className="text-sm mb-2">Theme</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDark(false)}
                className={`flex-1 py-2 rounded-xl text-sm ${!dark ? 'bg-white/20' : ''}`}
              >
                ☀️ Light
              </button>
              <button
                onClick={() => setDark(true)}
                className={`flex-1 py-2 rounded-xl text-sm ${dark ? 'bg-white/20' : ''}`}
              >
                🌙 Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
