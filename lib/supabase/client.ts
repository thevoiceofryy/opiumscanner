import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  // If Supabase isn't configured, return null instead of crashing
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase not configured")
    return null
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}