export type QuestionType = 'multiple-choice' | 'true-false' | 'open-text'

export type Question = {
  id: string
  type: QuestionType
  text: string
  options?: string[]
  correct: string
  timeLimit: number
  explanation?: string
  category?: string
}

export type Player = {
  name: string
  score: number
  streak: number
  team?: string
  lastSeen: number  // Date.now() timestamp
}

export type SessionPhase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'done' | 'cancelled'

export type SessionSettings = {
  speedPoints: boolean
  streaks: boolean
  teams: boolean
}

export type QuestionResult = {
  questionIndex: number
  questionText: string
  correct: string
  answers: Record<string, string>  // playerId → answer
}

export type Session = {
  id: string
  name: string
  hostToken: string
  quiz: Question[]
  players: Record<string, Player>
  phase: SessionPhase
  currentQuestion: number
  questionStartedAt: number | null
  answers: Record<string, string>
  settings: SessionSettings
  history: QuestionResult[]
}
