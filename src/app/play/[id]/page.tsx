'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import type { Session } from '@/lib/types'

function useSession(id: string) {
  const [session, setSession] = useState<Session | null>(null)
  const poll = useCallback(async () => {
    const res = await fetch(`/api/poll/${id}`)
    if (res.ok) setSession(await res.json())
  }, [id])
  useEffect(() => {
    poll()
    const interval = setInterval(poll, 1500)
    return () => clearInterval(interval)
  }, [poll])
  return { session, refresh: poll }
}

// Wärtsilä-branded option colors: navy, orange, teal, slate
const OPTION_STYLES = [
  { bg: '#1d6fa4' },
  { bg: '#FF5000' },
  { bg: '#006a6a' },
  { bg: '#7c3aed' },
]

const OPTION_SHAPES = ['▲', '◆', '●', '■']

export default function PlayPage() {
  const { id } = useParams<{ id: string }>()
  const { session, refresh } = useSession(id)
  const storageKey = `kahootklone-player-${id}`
  const [playerId, setPlayerId] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) setPlayerId(stored)
  }, [storageKey])
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; points: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const prevQuestionRef = useRef<number>(-1)

  const answered = !!(playerId && session?.answers?.[playerId])

  // Heartbeat — keeps player marked as online
  useEffect(() => {
    if (!playerId) return
    const beat = () => fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, playerId }),
    })
    beat()
    const interval = setInterval(beat, 5000)
    return () => clearInterval(interval)
  }, [id, playerId])

  async function leaveGame() {
    if (!playerId) return
    await fetch('/api/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, playerId }),
    })
    sessionStorage.removeItem(storageKey)
    setPlayerId(null)
    setName('')
    setJoining(false)
    setJoinError('')
  }

  useEffect(() => {
    if (!session) return
    if (session.currentQuestion !== prevQuestionRef.current) {
      prevQuestionRef.current = session.currentQuestion
      setLastResult(null)
    }
  }, [session?.currentQuestion])

  useEffect(() => {
    if (!session || session.phase !== 'question' || !session.questionStartedAt) { setTimeLeft(null); return }
    const question = session.quiz[session.currentQuestion]
    const tick = () => {
      const elapsed = (Date.now() - session.questionStartedAt!) / 1000
      setTimeLeft(Math.max(0, Math.ceil(question.timeLimit - elapsed)))
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [session?.phase, session?.questionStartedAt, session?.currentQuestion])

  async function join() {
    if (!name.trim()) { setJoinError('Enter your name.'); return }
    setJoining(true)
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, name: name.trim() }),
    })
    if (!res.ok) { setJoinError((await res.json()).error); setJoining(false); return }
    const { playerId: pid } = await res.json()
    sessionStorage.setItem(storageKey, pid)
    setPlayerId(pid)
    refresh()
  }

  async function submitAnswer(answer: string) {
    if (answered || submitting || !playerId) return
    setSubmitting(true)
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, playerId, answer }),
    })
    if (res.ok) setLastResult(await res.json())
    setSubmitting(false)
  }

  // Session expired
  if (!session) {
    if (playerId) return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: 'var(--w-navy)' }}>
        <div className="text-5xl">⏱️</div>
        <h2 className="text-xl font-bold text-white">Session ended</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>The host's session is no longer active.</p>
      </div>
    )
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--w-navy)' }}>
        <p className="text-white opacity-50">Loading…</p>
      </div>
    )
  }

  // Session cancelled by host
  if (session?.phase === 'cancelled') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: 'var(--w-navy)' }}>
      <div className="text-5xl">🛑</div>
      <h2 className="text-xl font-bold text-white">Session ended</h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>The host has ended this session.</p>
    </div>
  )

  // Join screen
  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--w-navy)' }}>
        <div className="bg-white rounded-lg p-8 w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--w-orange)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--w-navy)' }}>Join Quiz</h1>
          </div>
          {session?.name && (
            <p className="text-sm font-semibold" style={{ color: 'var(--w-navy)' }}>{session.name}</p>
          )}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && join()}
            placeholder="Your name"
            className="w-full rounded px-4 py-3 text-base text-center focus:outline-none"
            style={{ border: '2px solid var(--w-gray-100)', color: 'var(--w-navy)' }}
            autoFocus
          />
          {joinError && <p className="text-sm text-red-500 text-center">{joinError}</p>}
          <button
            onClick={join}
            disabled={joining}
            className="w-full py-3 rounded font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: 'var(--w-orange)' }}
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    )
  }

  const player = session.players[playerId]
  const question = session.quiz[session.currentQuestion]
  const sortedPlayers = Object.entries(session.players).sort(([, a], [, b]) => b.score - a.score)
  const rank = sortedPlayers.findIndex(([pid]) => pid === playerId) + 1

  // Lobby
  if (session.phase === 'lobby') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6" style={{ background: 'var(--w-navy)' }}>
        {session.name && (
          <div className="text-center mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Quiz</p>
            <h1 className="text-2xl font-bold text-white">{session.name}</h1>
          </div>
        )}
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
          style={{ background: 'var(--w-orange)' }}>
          {player?.name?.[0]?.toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-white">{player?.name}</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Waiting for the host to start…</p>
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--w-orange)', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <button onClick={leaveGame} className="mt-6 text-xs px-4 py-2 rounded border" style={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.15)' }}>
          Leave game
        </button>
      </div>
    )
  }

  // Question phase
  if (session.phase === 'question') {
    return (
      <div className="min-h-screen flex flex-col p-4 gap-4" style={{ background: 'var(--w-navy)' }}>
        {session.name && <p className="text-xs font-semibold text-center uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{session.name}</p>}
        {/* Timer */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: timeLeft !== null ? `${(timeLeft / question.timeLimit) * 100}%` : '100%',
                background: timeLeft !== null && timeLeft <= 5 ? '#ef4444' : 'var(--w-orange)',
              }}
            />
          </div>
          <span className="text-white font-bold text-sm w-6 text-right">{timeLeft}</span>
        </div>

        <p className="text-white text-xl font-semibold text-center py-4 leading-snug">{question.text}</p>

        {answered ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              ✓
            </div>
            <p className="text-xl font-bold text-white">Answer submitted</p>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Waiting for others…</p>
          </div>
        ) : question.type === 'multiple-choice' ? (
          <div className="grid grid-cols-2 gap-3">
            {(question.options ?? []).map((opt, i) => (
              <button
                key={opt}
                onClick={() => submitAnswer(opt)}
                disabled={submitting}
                className="text-white rounded-lg font-semibold text-base flex flex-col items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: OPTION_STYLES[i].bg, height: '110px' }}
              >
                <span className="text-2xl opacity-70">{OPTION_SHAPES[i]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        ) : question.type === 'true-false' ? (
          <div className="grid grid-cols-2 gap-3">
            {['true', 'false'].map((val, i) => (
              <button
                key={val}
                onClick={() => submitAnswer(val)}
                disabled={submitting}
                className="text-white rounded-lg font-bold text-2xl flex items-center justify-center capitalize disabled:opacity-50"
                style={{ background: OPTION_STYLES[i].bg, height: '110px' }}
              >
                {val}
              </button>
            ))}
          </div>
        ) : (
          <OpenTextAnswer onSubmit={submitAnswer} />
        )}
      </div>
    )
  }

  // Reveal
  if (session.phase === 'reveal') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6" style={{ background: 'var(--w-navy)' }}>
        {session.name && <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{session.name}</p>}
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
          style={{ background: lastResult?.isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
          {lastResult?.isCorrect ? '✓' : '✗'}
        </div>
        <p className="text-2xl font-bold text-white">{lastResult?.isCorrect ? 'Correct!' : 'Wrong'}</p>
        {lastResult?.isCorrect && (
          <p className="font-semibold" style={{ color: 'var(--w-orange)' }}>+{lastResult.points} pts</p>
        )}
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Correct answer: <strong className="text-white">{question.correct}</strong>
        </p>
        {question.explanation && (
          <div className="w-full max-w-sm rounded-lg px-4 py-3 text-left" style={{ background: 'rgba(255,255,255,0.06)', borderLeft: '3px solid var(--w-orange)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--w-orange)' }}>Explanation</p>
            <p className="text-sm text-white leading-relaxed">{question.explanation}</p>
          </div>
        )}
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Waiting for host…</p>
      </div>
    )
  }

  // Leaderboard / Done
  if (session.phase === 'leaderboard' || session.phase === 'done') {
    return (
      <div className="min-h-screen flex flex-col p-6 gap-5" style={{ background: 'var(--w-navy)' }}>
        {session.name && <p className="text-xs font-semibold uppercase tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{session.name}</p>}
        <h2 className="text-lg font-bold text-white text-center">
          {session.phase === 'done' ? 'Final scores' : 'Leaderboard'}
        </h2>
        <div className="space-y-2">
          {sortedPlayers.slice(0, 10).map(([pid, p], i) => (
            <div key={pid} className="flex items-center gap-3 rounded-lg px-4 py-3"
              style={{
                background: pid === playerId ? 'var(--w-orange)' : 'rgba(255,255,255,0.07)',
                border: pid === playerId ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>
              <span className="w-5 text-sm font-bold text-center"
                style={{ color: i === 0 && pid !== playerId ? 'var(--w-orange)' : 'rgba(255,255,255,0.5)' }}>
                {i + 1}
              </span>
              <span className="flex-1 font-medium text-white">{p.name}</span>
              {session.settings.streaks && p.streak > 1 && (
                <span className="text-xs" style={{ color: pid === playerId ? 'rgba(255,255,255,0.8)' : 'var(--w-orange)' }}>
                  🔥 {p.streak}
                </span>
              )}
              <span className="font-bold text-white">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Your rank: <strong className="text-white">#{rank}</strong> · Score: <strong className="text-white">{player?.score.toLocaleString()}</strong>
        </div>
        {session.phase !== 'done' && (
          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Waiting for next question…</p>
        )}
      </div>
    )
  }

  return null
}

function OpenTextAnswer({ onSubmit }: { onSubmit: (a: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex flex-col gap-3 mt-4">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && value.trim() && onSubmit(value.trim())}
        placeholder="Type your answer…"
        className="w-full rounded-lg px-4 py-3 text-base text-white focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        autoFocus
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        className="py-3 rounded-lg font-semibold text-white"
        style={{ background: 'var(--w-orange)' }}
      >
        Submit
      </button>
    </div>
  )
}
