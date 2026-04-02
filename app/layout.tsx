import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'iLaw — المساعد القانوني الذكي',
  description: 'منصة ذكاء اصطناعي قانونية للمحامين المصريين',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-arabic bg-bg-light dark:bg-[#1a1a1a] min-h-screen">
        {children}
      </body>
    </html>
  )
}
