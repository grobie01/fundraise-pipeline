export default function TestPage() {
  return (
    <div style={{ background: 'white', minHeight: '100vh', padding: '50px' }}>
      <h1 style={{ color: 'black' }}>Test Page</h1>
      <p style={{ color: 'black' }}>If you can see this, Next.js is working.</p>
      <a href="/api/auth/login" style={{ color: 'blue', textDecoration: 'underline' }}>
        Click here to try Google OAuth
      </a>
    </div>
  )
}
