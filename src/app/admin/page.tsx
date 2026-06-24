'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Question, QuestionType, SessionSettings } from '@/lib/types'
import { getDrafts, saveDraft, deleteDraft, type QuizDraft } from '@/lib/draftStore'
import { v4 as uuid } from 'uuid'

const DEFAULT_SETTINGS: SessionSettings = {
  speedPoints: true,
  streaks: true,
  teams: false,
}

const EMPTY_QUESTION = (): Omit<Question, 'id'> => ({
  type: 'multiple-choice',
  text: '',
  options: ['', '', '', ''],
  correct: '',
  timeLimit: 20,
})

function newDraft(): QuizDraft {
  return { id: uuid(), name: '', questions: [], settings: DEFAULT_SETTINGS, savedAt: new Date().toISOString() }
}

function formatSavedAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'upload' | 'manual'>('upload')
  const [drafts, setDrafts] = useState<QuizDraft[]>([])
  const [current, setCurrent] = useState<QuizDraft>(newDraft())
  const [questionDraft, setQuestionDraft] = useState(EMPTY_QUESTION())
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [activeSession, setActiveSession] = useState<string | null>(null)

  useEffect(() => {
    setActiveSession(localStorage.getItem('kahootklone-active-session'))
  }, [])

  useEffect(() => {
    const saved = getDrafts()
    setDrafts(saved)
    if (saved.length > 0) setCurrent(saved[0])
  }, [])

  function persist(updated: QuizDraft) {
    const withTime = { ...updated, savedAt: new Date().toISOString() }
    setCurrent(withTime)
    saveDraft(withTime)
    setDrafts(getDrafts())
  }

  function setQuestions(fn: (q: Question[]) => Question[]) {
    persist({ ...current, questions: fn(current.questions) })
  }

  function setSettings(fn: (s: SessionSettings) => SessionSettings) {
    persist({ ...current, settings: fn(current.settings) })
  }

  function handleNameChange(name: string) {
    persist({ ...current, name })
  }

  function loadDraft(draft: QuizDraft) {
    setCurrent(draft)
    setShowSessions(false)
  }

  function handleDeleteDraft(id: string) {
    deleteDraft(id)
    const remaining = getDrafts()
    setDrafts(remaining)
    if (current.id === id) setCurrent(remaining.length > 0 ? remaining[0] : newDraft())
  }

  function handleNew() {
    const d = newDraft()
    setCurrent(d)
    setShowSessions(false)
  }

  function parseRows(rows: Record<string, string>[]): Question[] {
    return rows
      .filter(r => r.question || r.text)
      .map(r => {
        const type = (r.type as QuestionType) || 'multiple-choice'
        const options = type === 'multiple-choice'
          ? [r.option_a, r.option_b, r.option_c, r.option_d].filter(Boolean)
          : undefined
        return {
          id: uuid(),
          type,
          text: r.question || r.text,
          options,
          correct: r.correct,
          timeLimit: Number(r.time_limit) || 20,
        }
      })
  }

  function processFile(file: File) {
    setError('')
    setUploadedFileName(file.name)
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: result => setQuestions(() => parseRows(result.data as Record<string, string>[])),
      })
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]])
        setQuestions(() => parseRows(rows))
      }
      reader.readAsBinaryString(file)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function addQuestion() {
    if (!questionDraft.text || !questionDraft.correct) { setError('Question text and correct answer are required.'); return }
    setQuestions(prev => [...prev, { ...questionDraft, id: uuid() }])
    setQuestionDraft(EMPTY_QUESTION())
    setError('')
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function startSession() {
    if (current.questions.length === 0) { setError('Add at least one question.'); return }
    setLoading(true)
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: current.name || 'Quiz', quiz: current.questions, settings: current.settings }),
    })
    const { id, hostToken } = await res.json()
    localStorage.setItem('kahootklone-active-session', id)
    localStorage.setItem(`kahootklone-host-token-${id}`, hostToken)
    router.push(`/session/${id}`)
  }

  const optionLabels = ['A', 'B', 'C', 'D']
  const { questions, settings } = current

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--w-gray-50)' }}>
      <div className="max-w-3xl mx-auto space-y-5" suppressHydrationWarning>

        {/* Header */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ background: 'var(--w-orange)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--w-navy)' }}>Quiz Editor</h1>
          </div>
          <button
            onClick={() => setShowSessions(s => !s)}
            className="text-sm font-medium px-3 py-1.5 rounded border transition-colors"
            style={{ color: 'var(--w-navy)', borderColor: 'var(--w-gray-400)', background: 'var(--w-gray-50)' }}
          >
            {showSessions ? '✕ Close' : `My quizzes (${drafts.length})`}
          </button>
        </div>

        {/* Session manager */}
        {showSessions && (
          <div className="bg-white rounded border divide-y" style={{ borderColor: 'var(--w-gray-100)' }}>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--w-gray-800)' }}>Saved quizzes</span>
              <button onClick={handleNew} className="text-sm font-medium" style={{ color: 'var(--w-orange)' }}>+ New quiz</button>
            </div>
            {drafts.length === 0 && (
              <p className="px-4 py-3 text-sm" style={{ color: 'var(--w-gray-400)' }}>No saved quizzes yet.</p>
            )}
            {drafts.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 transition-colors"
                style={{ background: d.id === current.id ? 'var(--w-gray-50)' : undefined }}>
                <button className="flex-1 text-left" onClick={() => loadDraft(d)}>
                  <p className="text-sm font-medium" style={{ color: 'var(--w-gray-800)' }}>
                    {d.name || <span className="italic" style={{ color: 'var(--w-gray-400)' }}>Untitled</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--w-gray-400)' }}>
                    {d.questions.length} question{d.questions.length !== 1 ? 's' : ''} · Saved {formatSavedAt(d.savedAt)}
                  </p>
                </button>
                {d.id === current.id && (
                  <span className="text-xs font-semibold mr-3 px-2 py-0.5 rounded-full" style={{ background: 'var(--w-navy)', color: 'white' }}>Active</span>
                )}
                <button onClick={() => handleDeleteDraft(d.id)} className="text-xs hover:text-red-500 transition-colors" style={{ color: 'var(--w-gray-400)' }}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {/* Active session rejoin banner */}
        {activeSession && (
          <div className="rounded px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: '#fff8e6', border: '1px solid #f0d080' }}>
            <p className="text-sm" style={{ color: 'var(--w-gray-800)' }}>You have an active session.</p>
            <div className="flex items-center gap-3">
              <a href={`/session/${activeSession}`} className="text-sm font-semibold hover:underline" style={{ color: 'var(--w-orange)' }}>
                Rejoin host panel →
              </a>
              <button
                onClick={async () => {
                  if (activeSession) {
                    const token = localStorage.getItem(`kahootklone-host-token-${activeSession}`) ?? ''
                    await fetch('/api/session/advance', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-host-token': token },
                      body: JSON.stringify({ id: activeSession, action: 'cancel' }),
                    })
                  }
                  localStorage.removeItem('kahootklone-active-session')
                  setActiveSession(null)
                }}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{ color: 'var(--w-gray-600)', borderColor: 'var(--w-gray-400)', background: 'white' }}
              >Dismiss</button>
            </div>
          </div>
        )}

        {/* Quiz name */}
        <div className="bg-white rounded border px-4 py-3 flex items-center gap-3" style={{ borderColor: 'var(--w-gray-100)' }}>
          <input
            value={current.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Untitled quiz"
            className="flex-1 text-lg font-semibold placeholder-gray-300 focus:outline-none bg-transparent"
            style={{ color: 'var(--w-navy)' }}
          />
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--w-gray-400)' }} suppressHydrationWarning>
            Saved {formatSavedAt(current.savedAt)}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b" style={{ borderColor: 'var(--w-gray-100)' }}>
          {(['upload', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: tab === t ? 'var(--w-orange)' : 'transparent',
                color: tab === t ? 'var(--w-navy)' : 'var(--w-gray-600)',
              }}
            >
              {t === 'upload' ? 'Upload File' : 'Add Manually'}
            </button>
          ))}
        </div>

        {/* Upload tab */}
        {tab === 'upload' && (
          <div className="bg-white rounded border p-6 space-y-4" style={{ borderColor: 'var(--w-gray-100)' }}>
            {/* Drop zone */}
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer"
              style={{
                borderColor: dragOver ? 'var(--w-orange)' : 'var(--w-gray-100)',
                background: dragOver ? '#fff8f5' : 'var(--w-gray-50)',
              }}
            >
              <div className="text-3xl">📂</div>
              {uploadedFileName ? (
                <>
                  <p className="text-sm font-semibold" style={{ color: 'var(--w-navy)' }}>✓ {uploadedFileName}</p>
                  <p className="text-xs" style={{ color: 'var(--w-gray-400)' }}>Click or drop to replace</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{ color: 'var(--w-navy)' }}>Drop your file here</p>
                  <p className="text-xs" style={{ color: 'var(--w-gray-400)' }}>or click to browse — CSV or Excel (.xlsx)</p>
                </>
              )}
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>

            {/* Template + format hint */}
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs" style={{ color: 'var(--w-gray-400)' }}>
                Required columns: <code className="px-1 rounded" style={{ background: 'var(--w-gray-100)' }}>type, question, option_a…d, correct, time_limit</code>
              </p>
              <a href="/template.csv" download className="text-xs font-semibold whitespace-nowrap hover:underline" style={{ color: 'var(--w-orange)' }}>
                Download template ↓
              </a>
            </div>
          </div>
        )}

        {/* Manual tab */}
        {tab === 'manual' && (
          <div className="bg-white rounded border p-6 space-y-4" style={{ borderColor: 'var(--w-gray-100)' }}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--w-gray-600)' }}>Question type</label>
                <select
                  value={questionDraft.type}
                  onChange={e => setQuestionDraft({ ...EMPTY_QUESTION(), type: e.target.value as QuestionType })}
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--w-gray-100)', color: 'var(--w-gray-800)' }}
                >
                  <option value="multiple-choice">Multiple choice</option>
                  <option value="true-false">True / False</option>
                  <option value="open-text">Open text</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--w-gray-600)' }}>Question</label>
                <textarea
                  value={questionDraft.text}
                  onChange={e => setQuestionDraft(d => ({ ...d, text: e.target.value }))}
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--w-gray-100)', color: 'var(--w-gray-800)' }}
                  rows={2}
                />
              </div>

              {questionDraft.type === 'multiple-choice' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: 'var(--w-gray-600)' }}>Options</label>
                  {(questionDraft.options ?? ['', '', '', '']).map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-bold w-4" style={{ color: 'var(--w-gray-400)' }}>{optionLabels[i]}</span>
                      <input
                        value={opt}
                        onChange={e => {
                          const opts = [...(questionDraft.options ?? ['', '', '', ''])]
                          opts[i] = e.target.value
                          setQuestionDraft(d => ({ ...d, options: opts }))
                        }}
                        className="flex-1 rounded px-3 py-1.5 text-sm focus:outline-none"
                        style={{
                          border: `1px solid ${!questionDraft.correct ? 'var(--w-gray-100)' : questionDraft.correct === opt ? '#22c55e' : '#f87171'}`,
                          color: 'var(--w-gray-800)',
                        }}
                      />
                      <input
                        type="radio"
                        name={`correct-answer-${questions.length}`}
                        value={opt}
                        checked={questionDraft.correct === opt}
                        onChange={() => setQuestionDraft(d => ({ ...d, correct: opt }))}
                        title="Mark as correct"
                        style={{ accentColor: 'var(--w-navy)' }}
                      />
                    </div>
                  ))}
                  <p className="text-xs" style={{ color: 'var(--w-gray-400)' }}>Select the correct answer with the radio button</p>
                </div>
              )}

              {questionDraft.type === 'true-false' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--w-gray-600)' }}>Correct answer</label>
                  <select
                    value={questionDraft.correct}
                    onChange={e => setQuestionDraft(d => ({ ...d, correct: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid var(--w-gray-100)', color: 'var(--w-gray-800)' }}
                  >
                    <option value="">Select…</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              )}

              {questionDraft.type === 'open-text' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--w-gray-600)' }}>Correct answer</label>
                  <input
                    value={questionDraft.correct}
                    onChange={e => setQuestionDraft(d => ({ ...d, correct: e.target.value }))}
                    className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1px solid var(--w-gray-100)', color: 'var(--w-gray-800)' }}
                    placeholder="Exact answer (case-insensitive)"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--w-gray-600)' }}>Time limit (seconds)</label>
                <input
                  type="number"
                  value={questionDraft.timeLimit}
                  min={5}
                  max={120}
                  onChange={e => setQuestionDraft(d => ({ ...d, timeLimit: Number(e.target.value) }))}
                  className="w-32 rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid var(--w-gray-100)', color: 'var(--w-gray-800)' }}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={addQuestion}
              className="px-5 py-2 rounded text-sm font-semibold text-white transition-colors"
              style={{ background: 'var(--w-navy)' }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--w-navy-light)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--w-navy)')}
            >
              Add question
            </button>
          </div>
        )}

        {/* Question list */}
        {questions.length > 0 && (
          <div className="bg-white rounded border p-5 space-y-2" style={{ borderColor: 'var(--w-gray-100)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--w-navy)' }}>
                Questions ({questions.length})
              </h2>
              <button onClick={() => setQuestions(() => [])} className="text-xs px-2 py-1 rounded border hover:text-red-500 hover:border-red-300 transition-colors" style={{ width: '72px', color: 'var(--w-gray-600)', borderColor: 'var(--w-gray-400)', background: 'var(--w-gray-50)' }}>
                Clear all
              </button>
            </div>
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--w-gray-100)' }}>
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button onClick={() => moveQuestion(i, -1)} disabled={i === 0}
                    className="w-6 h-5 flex items-center justify-center rounded text-xs border disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--w-gray-600)', borderColor: 'var(--w-gray-400)', background: 'var(--w-gray-50)' }}>▲</button>
                  <button onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1}
                    className="w-6 h-5 flex items-center justify-center rounded text-xs border disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--w-gray-600)', borderColor: 'var(--w-gray-400)', background: 'var(--w-gray-50)' }}>▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--w-orange)' }}>{q.type}</span>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--w-gray-800)' }}>{i + 1}. {q.text}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--w-gray-400)' }}>Correct: {q.correct}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0" style={{ width: '72px' }}>
                  <button onClick={() => removeQuestion(q.id)} className="w-full text-xs px-2 py-1 rounded border hover:text-red-500 hover:border-red-300 transition-colors" style={{ color: 'var(--w-gray-600)', borderColor: 'var(--w-gray-400)', background: 'var(--w-gray-50)' }}>
                    Remove
                  </button>
                  <div className="flex items-center w-full text-xs" style={{ color: 'var(--w-gray-400)' }}>
                    <input
                      type="number"
                      value={q.timeLimit}
                      min={5}
                      max={120}
                      onChange={e => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, timeLimit: Number(e.target.value) } : x))}
                      className="flex-1 min-w-0 text-center rounded-l px-1 py-1 focus:outline-none"
                      style={{ border: '1px solid var(--w-gray-400)', borderRight: 'none', color: 'var(--w-gray-600)', fontSize: 'inherit', background: 'var(--w-gray-50)' }}
                    />
                    <span className="px-1.5 py-1 rounded-r" style={{ border: '1px solid var(--w-gray-400)', background: 'var(--w-gray-50)' }}>s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        <div className="bg-white rounded border p-5 space-y-3" style={{ borderColor: 'var(--w-gray-100)' }}>
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--w-navy)' }}>Gamification</h2>
          {([
            ['speedPoints', 'Speed points — faster answers score more'],
            ['streaks', 'Streaks — bonus for consecutive correct answers'],
            ['teams', 'Team mode — players compete as teams'],
          ] as [keyof SessionSettings, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
                className="w-4 h-4"
                style={{ accentColor: 'var(--w-navy)' }}
              />
              <span className="text-sm" style={{ color: 'var(--w-gray-600)' }}>{label}</span>
            </label>
          ))}
        </div>

        {error && tab === 'upload' && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={startSession}
          disabled={loading || questions.length === 0}
          className="w-full py-3 rounded font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--w-orange)' }}
          onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--w-orange-dark)' }}
          onMouseOut={e => (e.currentTarget.style.background = 'var(--w-orange)')}
        >
          {loading ? 'Starting…' : `Start session · ${questions.length} question${questions.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
