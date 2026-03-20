'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useAnnouncement } from '@/hooks/use-announcement'

export function AnnouncementBanner() {
  const { announcement } = useAnnouncement()
  const [dismissed, setDismissed] = useState(false)

  if (!announcement || dismissed) return null

  const colors = {
    info:    'bg-blue-950/80 border-blue-500/50 text-blue-200',
    warning: 'bg-yellow-950/80 border-yellow-500/50 text-yellow-200',
    success: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200',
    error:   'bg-red-950/80 border-red-500/50 text-red-200',
  }

return (
  <div className={`w-full px-4 py-2 border-b flex items-center justify-center relative text-xs font-mono ${colors[announcement.type]}`}>
    <span>{announcement.message}</span>
    <button onClick={() => setDismissed(true)} className="absolute right-4 opacity-60 hover:opacity-100">
      <X className="w-3 h-3" />
    </button>
  </div>
)
}