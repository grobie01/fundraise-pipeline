import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const redirectUrl = new URL('/auth/callback', request.url).toString()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account', // Force account selection
      },
    },
  })

  if (error) {
    console.error('OAuth init error:', error)
    return NextResponse.redirect(new URL(`/login?error=${error.message}`, request.url))
  }

  if (data.url) {
    return NextResponse.redirect(data.url)
  }

  return NextResponse.redirect(new URL('/login?error=no_url', request.url))
}
