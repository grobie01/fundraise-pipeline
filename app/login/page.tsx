'use client'

import { getSupabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()
  const supabase = getSupabase()

  // Check for error in URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const errorParam = params.get('error')
      if (errorParam) {
        setError(decodeURIComponent(errorParam))
        setCheckingSession(false)
      }
    }
  }, [])

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking session...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Failed to check session: ' + sessionError.message)
          setCheckingSession(false)
          return
        }

        console.log('Session:', session ? 'exists' : 'none')

        if (session) {
          console.log('Redirecting to dashboard...')
          // Add a delay to ensure cookies are set
          setTimeout(() => {
            router.push('/dashboard')
          }, 500)
        } else {
          setCheckingSession(false)
        }
      } catch (err) {
        console.error('Error checking session:', err)
        setError('Failed to check authentication status')
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [router, supabase.auth])

  const handleGoogleLogin = () => {
    console.log('Redirecting to OAuth API route...')
    setLoading(true)
    window.location.href = '/api/auth/login'
  }

  if (checkingSession) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
      }}>
        <div style={{ textAlign: 'center' }}>
          {!error ? (
            <>
              <div style={{
                border: '3px solid transparent',
                borderTop: '3px solid #2563eb',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
              }} />
              <p style={{ marginTop: '16px', color: '#6b7280' }}>Checking authentication...</p>
            </>
          ) : (
            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
              <div style={{
                padding: '16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
              }}>
                <p style={{ fontSize: '14px', color: '#991b1b' }}>{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null)
                  setCheckingSession(false)
                }}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  color: '#2563eb',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
      padding: '16px',
    }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '8px',
          }}>
            Fundraise Tracker
          </h1>
          <p style={{ color: '#6b7280' }}>
            Sign in to manage your fundraising pipelines
          </p>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          padding: '32px',
        }}>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              color: '#374151',
              background: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              fontSize: '16px',
              fontWeight: '500',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.background = '#f9fafb'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'white'
            }}
          >
            {loading ? (
              <>
                <div style={{
                  border: '2px solid transparent',
                  borderTop: '2px solid #374151',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  animation: 'spin 1s linear infinite',
                }} />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          {error && (
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
            }}>
              <p style={{ fontSize: '14px', color: '#991b1b' }}>{error}</p>
            </div>
          )}

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#6b7280',
          }}>
            <p>Login required to create and manage pipelines.</p>
            <p style={{ marginTop: '8px' }}>Shareable links work without login.</p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
