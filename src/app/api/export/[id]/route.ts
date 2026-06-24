import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSession } from '@/lib/store'

const GREEN = { argb: 'FF22C55E' }
const RED   = { argb: 'FFEF4444' }
const WHITE = { argb: 'FFFFFFFF' }
const BLACK = { argb: 'FF000000' }
const NAVY  = { argb: 'FF003057' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Results')

  // Header row
  const headers = [
    'Player',
    ...session.history.map((h, i) => `Q${i + 1}: ${h.questionText}`),
    'Total score',
  ]
  const headerRow = ws.addRow(headers)
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY }
    cell.font = { bold: true, color: WHITE }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  ws.getRow(1).height = 30

  // One row per player
  const playerList = Object.entries(session.players)
  playerList.forEach(([playerId, player]) => {
    const values = [
      player.name,
      ...session.history.map(h => h.answers[playerId] ?? '—'),
      player.score,
    ]
    const row = ws.addRow(values)

    // Color-code each answer cell
    session.history.forEach((h, i) => {
      const cell = row.getCell(i + 2) // +2: skip player name col
      const given = h.answers[playerId]
      if (!given) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } }
      } else {
        const correct = given.trim().toLowerCase() === h.correct.trim().toLowerCase()
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: correct ? GREEN : RED }
        cell.font = { color: correct ? BLACK : WHITE }
      }
    })

    row.getCell(1).font = { bold: true }
  })

  // Column widths
  ws.getColumn(1).width = 20
  session.history.forEach((_, i) => { ws.getColumn(i + 2).width = 28 })
  ws.getColumn(headers.length).width = 14

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
