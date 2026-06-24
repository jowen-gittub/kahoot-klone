'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const QUESTION = 'What is the best way to make your workshop more engaging?'
const OPTIONS = [
  { label: 'A', text: 'Read from 47 slides', correct: false, shape: '▲' },
  { label: 'B', text: 'Hand out a 12-page worksheet', correct: false, shape: '◆' },
  { label: 'C', text: 'Ask everyone to "just discuss"', correct: false, shape: '●' },
  { label: 'D', text: 'Run a live quiz with KahootKlone', correct: true, shape: '■' },
]

export default function Home() {
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [tick, setTick] = useState(30)

  useEffect(() => {
    if (revealed) return
    if (tick <= 0) { setRevealed(true); return }
    const t = setTimeout(() => setTick(t => t - 1), 1000)
    return () => clearTimeout(t)
  }, [tick, revealed])

  function pick(i: number) {
    setSelected(i)
    setRevealed(true)
  }

  const COLORS = [
    { base: '#1d6fa4', dim: '#1d6fa420' },
    { base: '#FF5000', dim: '#FF500020' },
    { base: '#006a6a', dim: '#006a6a20' },
    { base: '#7c3aed', dim: '#7c3aed20' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--w-navy)' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full" style={{ background: 'var(--w-orange)' }} />
          <span className="font-bold text-white text-lg tracking-tight">KahootKlone</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/join" className="text-sm font-medium hover:underline" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Join a quiz
          </Link>
          <Link href="/admin" className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors"
            style={{ background: 'var(--w-orange)' }}>
            Host a quiz
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-10 max-w-2xl mx-auto w-full">

        {/* Fake quiz card */}
        <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {/* Timer bar */}
          <div className="h-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: revealed ? '0%' : `${(tick / 30) * 100}%`,
                background: tick <= 5 && !revealed ? '#ef4444' : 'var(--w-orange)',
              }}
            />
          </div>

          <div className="p-7 space-y-5">
            <p className="text-lg font-bold text-white text-center leading-snug">{QUESTION}</p>

            <div className="grid grid-cols-2 gap-3">
              {OPTIONS.map((opt, i) => {
                const isCorrect = opt.correct
                const isSelected = selected === i
                const bg = revealed
                  ? isCorrect ? COLORS[i].base : COLORS[i].dim
                  : COLORS[i].base
                const opacity = revealed && !isCorrect ? 0.4 : 1

                return (
                  <button
                    key={i}
                    onClick={() => !revealed && pick(i)}
                    disabled={revealed}
                    className="rounded-xl font-semibold text-sm flex flex-col items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: bg,
                      height: '90px',
                      opacity,
                      color: 'white',
                      border: isSelected && !isCorrect ? '2px solid #ef4444' : revealed && isCorrect ? '2px solid #22c55e' : '2px solid transparent',
                      transform: revealed && isCorrect ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    <span className="text-xl opacity-70">{opt.shape}</span>
                    <span className="text-center px-2">{opt.text}</span>
                  </button>
                )
              })}
            </div>

            {revealed && (
              <div className="text-center space-y-1 pt-1">
                <p className="text-sm font-semibold" style={{ color: '#86efac' }}>
                  ✓ Correct! Obviously.
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Your colleagues will thank you. Probably.
                </p>
              </div>
            )}

            {!revealed && (
              <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {tick > 0 ? `${tick}s — or just click the obvious answer` : 'Time\'s up!'}
              </p>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Live quizzes for<br />workshops that actually work.
          </h1>
          <p className="text-base max-w-md" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Upload your questions, share a link, watch the answers roll in.
            No account required for players.
          </p>
          <div className="flex gap-3 mt-2">
            <Link href="/admin"
              className="px-6 py-3 rounded-lg font-bold text-white text-base transition-colors"
              style={{ background: 'var(--w-orange)' }}>
              Start hosting →
            </Link>
            <Link href="/join"
              className="px-6 py-3 rounded-lg font-semibold text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
              Join a quiz
            </Link>
          </div>
        </div>

      </main>

      <footer className="text-center pb-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Built for workshops that deserve better than slide 47.
      </footer>
    </div>
  )
}
