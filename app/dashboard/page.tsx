'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

interface List {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
  investor_count: number
  status_counts: Record<string, number>
}

export default function DashboardPage() {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuthAndFetchLists = async () => {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)

        const response = await fetch('/api/lists', {
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Lists API error:', errorData)
          throw new Error(errorData.error || 'Failed to fetch lists')
        }

        const data = await response.json()
        setLists(data.lists || [])

      } catch (err) {
        console.error('Error fetching lists:', err)
        setError('Failed to load your pipelines')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetchLists()
  }, [router])

  const handleLogout = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const copyLinkToClipboard = (slug: string) => {
    const url = `${window.location.origin}/list/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '3px solid transparent',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }} />
          <p style={{ marginTop: '16px', color: '#a0a0b0', fontFamily: "'Space Grotesk', sans-serif" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <header style={{
        background: '#12121a',
        borderBottom: '1px solid #1a1a2a',
        padding: '20px 0',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#ffffff',
            margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Fundraise Tracker
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="/export"
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Create Pipeline
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#a0a0b0' }}>
                {user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'Loading...'}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  fontSize: '14px',
                  color: '#6a6a7a',
                  background: 'transparent',
                  border: '1px solid #2a2a3a',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#3a3a4a'
                  e.currentTarget.style.color = '#a0a0b0'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#2a2a3a'
                  e.currentTarget.style.color = '#6a6a7a'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#ffffff',
            margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Your Pipelines
          </h2>
          <p style={{
            color: '#6a6a7a',
            marginTop: '8px',
            fontSize: '14px',
          }}>
            Manage your fundraising pipelines
          </p>
        </div>

        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
          }}>
            <p style={{ fontSize: '14px', color: '#f87171', margin: 0 }}>{error}</p>
          </div>
        )}

        {lists.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 48px',
            background: '#12121a',
            borderRadius: '16px',
            border: '1px solid #1a1a2a',
          }}>
            <div style={{
              color: '#3a3a4a',
              marginBottom: '16px',
              fontSize: '48px',
            }}>
              📋
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '8px',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              No pipelines yet
            </h3>
            <p style={{
              color: '#6a6a7a',
              marginBottom: '24px',
              fontSize: '14px',
            }}>
              Get started by creating your first fundraising pipeline
            </p>
            <a
              href="/export"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Create Your First Pipeline
            </a>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {lists.map((list) => (
              <div
                key={list.id}
                style={{
                  background: '#12121a',
                  borderRadius: '12px',
                  border: '1px solid #1a1a2a',
                  padding: '24px',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#2a2a3a'
                  e.currentTarget.style.background = '#14141c'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#1a1a2a'
                  e.currentTarget.style.background = '#12121a'
                }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <a
                    href={`/list/${list.slug}`}
                    style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = '#818cf8'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = '#ffffff'
                    }}
                  >
                    {list.name}
                  </a>
                </div>

                {/* Status counts */}
                <div style={{
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#a0a0b0',
                }}>
                  {Object.entries(list.status_counts).length > 0 ? (
                    Object.entries(list.status_counts).map(([status, count]) => (
                      <div key={status} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        padding: '4px 0',
                      }}>
                        <span style={{ color: '#8a8a9a' }}>{status}:</span>
                        <span style={{ fontWeight: '600', color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{
                      color: '#5a5a6a',
                      fontStyle: 'italic',
                      margin: 0,
                    }}>
                      No investors yet
                    </p>
                  )}
                </div>

                {/* Metadata */}
                <div style={{
                  fontSize: '12px',
                  color: '#5a5a6a',
                  marginBottom: '16px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Last modified: {formatDate(list.updated_at)}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => copyLinkToClipboard(list.slug)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      fontSize: '13px',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      background: 'transparent',
                      color: '#a0a0b0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: '500',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#0a0a0f'
                      e.currentTarget.style.borderColor = '#3a3a4a'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#2a2a3a'
                    }}
                  >
                    {copiedSlug === list.slug ? '✓ Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={`/list/${list.slug}`}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      fontSize: '13px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: 'white',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: '500',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.opacity = '0.9'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.opacity = '1'
                    }}
                  >
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}
