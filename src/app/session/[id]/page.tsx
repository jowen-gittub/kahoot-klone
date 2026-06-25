'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useSession } from '@/lib/useSession'

function getHostToken(id: string) {
  return localStorage.getItem(`kahootklone-host-token-${id}`) ?? ''
}

async function advance(id: string, action: string) {
  await fetch('/api/session/advance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-host-token': getHostToken(id) },
    body: JSON.stringify({ id, action }),
  })
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const { session, refresh } = useSession(id)
  const [playUrl, setPlayUrl] = useState('')

  useEffect(() => {
    setPlayUrl(`${window.location.origin}/play/${id}`)
  }, [id])

  useEffect(() => {
    if (session?.phase === 'done') {
      localStorage.removeItem('kahootklone-active-session')
    }
  }, [session?.phase])

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--w-navy)' }}>
      <p className="text-white opacity-60">Loading…</p>
    </div>
  )

  const question = session.quiz[session.currentQuestion]
  const answeredCount = Object.keys(session.answers).length
  const playerCount = Object.keys(session.players).length
  const onlineCount = Object.values(session.players).filter(p => Date.now() - p.lastSeen < 15000).length
  const sortedPlayers = Object.entries(session.players).sort(([, a], [, b]) => b.score - a.score)

  async function act(action: string) {
    await advance(id, action)
    refresh()
  }

  const phaseBadge: Record<string, { label: string; bg: string }> = {
    lobby:       { label: 'Lobby',       bg: 'var(--w-gray-400)' },
    question:    { label: 'Live',        bg: 'var(--w-orange)' },
    reveal:      { label: 'Reveal',      bg: '#22c55e' },
    leaderboard: { label: 'Leaderboard', bg: 'var(--w-navy-light)' },
    done:        { label: 'Done',        bg: 'var(--w-gray-400)' },
  }
  const badge = phaseBadge[session.phase]

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--w-navy)' }}>
      <div className="mx-auto space-y-6" style={{ maxWidth: '42rem' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-8 rounded-full" style={{ background: 'var(--w-orange)' }} />
              <h1 className="text-2xl font-bold text-white">Host Panel</h1>
            </div>
            <div className="flex items-center gap-4 pl-4">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Session <span className="font-mono font-semibold">{id}</span>
              </p>
              <a href="/admin" className="text-sm hover:underline" style={{ color: 'rgba(255,255,255,0.4)' }}>← Admin</a>
            </div>
          </div>
          <span className="text-sm font-bold px-4 py-1.5 rounded-full text-white uppercase tracking-wide"
            style={{ background: badge.bg }}>
            {badge.label}
          </span>
        </div>

        {/* Lobby */}
        {session.phase === 'lobby' && (
          <div className="rounded-xl p-7 space-y-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {/* QR + join info */}
            <div className="flex gap-8 items-start">
              {playUrl && (
                <div className="shrink-0 space-y-2">
                  <div className="p-3 rounded-xl" style={{ background: 'white' }}>
                    <QRCodeSVG value={playUrl} size={128} />
                  </div>
                  {playUrl.includes('localhost') && (
                    <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>⚠ localhost only</p>
                  )}
                </div>
              )}
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Session code</p>
                  <p className="text-5xl font-bold tracking-widest text-white">{id}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Join at</p>
                  {[
                    { url: playUrl || '/play/' + id },
                    { url: playUrl ? new URL(playUrl).origin + '/join' : '/join' },
                  ].map(({ url }) => (
                    <div key={url} className="flex items-center gap-3">
                      <code className="text-sm flex-1 break-all" style={{ color: 'rgba(255,255,255,0.7)' }}>{url}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(url)}
                        className="text-xs font-semibold shrink-0 px-3 py-1 rounded"
                        style={{ background: 'var(--w-orange)', color: 'white' }}
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Players */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Players joined — {onlineCount} online{playerCount !== onlineCount ? `, ${playerCount - onlineCount} offline` : ''}
              </p>
              {playerCount > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.values(session.players).map(p => {
                    const online = Date.now() - p.lastSeen < 15000
                    return (
                      <span key={p.name} className="text-sm px-4 py-1.5 rounded-full flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.1)', color: online ? 'white' : 'rgba(255,255,255,0.35)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: online ? '#22c55e' : 'rgba(255,255,255,0.2)' }} />
                        {p.name}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Waiting for players…</p>
              )}
            </div>

            <button
              onClick={() => act('start-question')}
              disabled={playerCount === 0}
              className="w-full py-4 rounded-lg text-base font-bold text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'var(--w-orange)' }}
            >
              Begin quiz · {session.quiz.length} question{session.quiz.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Question / Reveal */}
        {(session.phase === 'question' || session.phase === 'reveal') && (
          <div className="rounded-xl p-7 space-y-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Question {session.currentQuestion + 1} / {session.quiz.length}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                {question.type}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-3xl font-bold text-white leading-snug">{question.text}</p>
              {question.category && (
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{question.category}</p>
              )}
            </div>

            {question.options && (
              <div className="grid grid-cols-2 gap-3">
                {question.options.map(opt => (
                  <div
                    key={opt}
                    className="rounded-lg px-5 py-4 text-base font-medium transition-all"
                    style={{
                      background: session.phase === 'reveal'
                        ? opt === question.correct ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)'
                        : 'rgba(255,255,255,0.08)',
                      color: session.phase === 'reveal'
                        ? opt === question.correct ? '#86efac' : 'rgba(255,255,255,0.3)'
                        : 'white',
                      border: session.phase === 'reveal' && opt === question.correct
                        ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}

            {session.phase === 'reveal' && (
              <div className="space-y-3">
                <p className="text-base" style={{ color: '#86efac' }}>
                  ✓ Correct answer: <strong>{question.correct}</strong>
                </p>
                {question.explanation && (
                  <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', borderLeft: '3px solid var(--w-orange)' }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--w-orange)' }}>Explanation</p>
                    <p className="text-sm text-white leading-relaxed">{question.explanation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>{answeredCount} / {playerCount} answered</span>
                <span>{playerCount ? Math.round((answeredCount / playerCount) * 100) : 0}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: playerCount ? `${(answeredCount / playerCount) * 100}%` : '0%',
                    background: 'var(--w-orange)',
                  }}
                />
              </div>
            </div>

            {session.phase === 'question' && (
              <button onClick={() => act('reveal')}
                className="w-full py-4 rounded-lg text-base font-bold text-white"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                Reveal answer
              </button>
            )}
            {session.phase === 'reveal' && (
              <button onClick={() => act('leaderboard')}
                className="w-full py-4 rounded-lg text-base font-bold text-white"
                style={{ background: 'var(--w-orange)' }}>
                Show leaderboard
              </button>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {(session.phase === 'leaderboard' || session.phase === 'done') && (
          <div className="rounded-xl p-7 space-y-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {session.phase === 'done' ? 'Final scores' : 'Leaderboard'}
            </h2>
            <div className="space-y-2">
              {sortedPlayers.map(([, p], i) => (
                <div key={p.name} className="flex items-center gap-4 rounded-lg px-5 py-3.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-lg font-bold w-6 text-center"
                    style={{ color: i === 0 ? 'var(--w-orange)' : 'rgba(255,255,255,0.35)' }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-base text-white font-medium">{p.name}</span>
                  {session.settings.streaks && p.streak > 1 && (
                    <span className="text-sm" style={{ color: 'var(--w-orange)' }}>🔥 {p.streak}</span>
                  )}
                  <span className="text-lg font-bold text-white">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {session.phase === 'leaderboard' && (
              <button onClick={() => act('next')}
                className="w-full py-4 rounded-lg text-base font-bold text-white mt-2"
                style={{ background: 'var(--w-orange)' }}>
                {session.currentQuestion + 1 < session.quiz.length ? 'Next question' : 'Finish quiz'}
              </button>
            )}
            {session.phase === 'done' && (
              <button
                onClick={async () => {
                  const res = await fetch(`/api/export/${id}`, { headers: { 'x-host-token': getHostToken(id) } })
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  const cd = res.headers.get('content-disposition') ?? ''
                  const match = cd.match(/filename="([^"]+)"/)
                  a.href = url
                  a.download = match?.[1] ?? 'results.xlsx'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-lg text-base font-bold text-white mt-2"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                ↓ Export results (.xlsx)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
