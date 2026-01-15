import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      fontFamily: "'Space Grotesk', sans-serif",
      color: '#a0a0b0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        borderRadius: '12px',
        marginBottom: '24px',
      }} />
      <h1 style={{
        fontSize: '32px',
        fontWeight: '600',
        color: '#ffffff',
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: '12px',
      }}>
        Fundraise Pipeline Tracker
      </h1>
      <p style={{ fontSize: '16px', color: '#5a5a6a', marginBottom: '40px' }}>
        Collaborate on investor pipelines with your portfolio companies
      </p>
      <Link
        href="/export"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '500',
          fontSize: '14px',
        }}
      >
        Export from Attio →
      </Link>
    </div>
  )
}
