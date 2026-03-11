import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json([])
    }

    const { data, error } = await supabase
      .from('user_markets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user markets:', error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('User markets API error:', error)
    return NextResponse.json([])
  }
}
