import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSession } from '@/lib/store'
import { validateHostToken } from '@/lib/auth'

const GREEN  = { argb: 'FF22C55E' }
const RED    = { argb: 'FFEF4444' }
const WHITE  = { argb: 'FFFFFFFF' }
const BLACK  = { argb: 'FF000000' }
const NAVY   = { argb: 'FF003057' }
const GRAY   = { argb: 'FFDDDDDD' }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authError = validateHostToken(req, id)
  if (authError) return authError
  const session = getSession(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Results')

  const playerList = Object.entries(session.players)

  // Header row: Question | Correct answer | Player 1 | Player 2 | ... | % Correct
  const headers = [
    'Question',
    'Correct answer',
    ...playerList.map(([, p]) => p.name),
    '% Correct',
  ]
  const headerRow = ws.addRow(headers)
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY }
    cell.font = { bold: true, color: WHITE }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  ws.getRow(1).height = 30

  // One row per question
  session.history.forEach((h, qi) => {
    const values = [
      `Q${qi + 1}: ${h.questionText}`,
      h.correct,
      ...playerList.map(([playerId]) => h.answers[playerId] ?? '—'),
    ]
    const row = ws.addRow(values)

    // Style question + correct answer columns
    row.getCell(1).font = { bold: true }
    row.getCell(2).font = { bold: true, color: { argb: 'FF166534' } }
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdcfce7' } }

    // Color-code each player's answer
    let correctCount = 0
    playerList.forEach(([playerId], pi) => {
      const cell = row.getCell(pi + 3) // +3: skip question + correct cols
      const given = h.answers[playerId]
      if (!given) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: GRAY }
      } else {
        const isCorrect = given.trim().toLowerCase() === h.correct.trim().toLowerCase()
        if (isCorrect) correctCount++
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: isCorrect ? GREEN : RED }
        cell.font = { color: isCorrect ? BLACK : WHITE }
      }
    })

    // % correct
    const answeredCount = Object.keys(h.answers).length
    const pct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
    const pctCell = row.getCell(headers.length)
    pctCell.value = `${pct}%`
    pctCell.font = { bold: true }
    pctCell.alignment = { horizontal: 'center' }
  })

  // Score row at the bottom
  const scoreValues = ['Total score', '', ...playerList.map(([, p]) => p.score), '']
  const scoreRow = ws.addRow(scoreValues)
  scoreRow.eachCell(cell => {
    cell.font = { bold: true, color: WHITE }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY }
  })

  // Column widths
  ws.getColumn(1).width = 48  // question
  ws.getColumn(2).width = 20  // correct answer
  playerList.forEach((_, i) => { ws.getColumn(i + 3).width = 18 })
  ws.getColumn(headers.length).width = 12  // % correct

  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }]

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}`
  const safeName = (session.name || 'Quiz').replace(/[\/\\:*?"<>|]/g, '')
  const filename = `${safeName} ${timestamp} results.xlsx`

  const buf = Buffer.from(await wb.xlsx.writeBuffer())
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
