'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Announcement {
  id: number
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  active: boolean
}

export function useAnnouncement() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) setAnnouncement(data)
    }

    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [])

  return { announcement }
}