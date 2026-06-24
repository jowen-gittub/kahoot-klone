'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!password) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push(searchParams.get('from') ?? '/admin')
    } else {
      setError('Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg p-8 w-full max-w-sm space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-6 rounded-full" style={{ background: 'var(--w-orange)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--w-navy)' }}>Admin access</h1>
      </div>
      <p className="text-sm" style={{ color: 'var(--w-gray-400)' }}>Enter the admin password to continue.</p>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        placeholder="Password"
        className="w-full rounded px-4 py-3 text-base focus:outline-none"
        style={{ border: '2px solid var(--w-gray-100)', color: 'var(--w-navy)' }}
        autoFocus
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={handleLogin}
        disabled={loading || !password}
        className="w-full py-3 rounded font-semibold text-white transition-colors disabled:opacity-40"
        style={{ background: 'var(--w-orange)' }}
      >
        {loading ? 'Checking…' : 'Sign in'}
      </button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--w-navy)' }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
