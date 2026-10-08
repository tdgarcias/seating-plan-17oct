import type { Guest, Scenario, TableItem, TableSection } from '@/types'
import { computeSeatPositions, defaultSeatsPerSide } from './geometry'
import { createId } from './id'

/**
 * Submesas
 * --------
 * Una mesa rectangular (imperial) puede partirse en tramos a lo largo de su lado largo.
 * Cada tramo incluye los asientos de arriba y de abajo que quedan enfrentados y funciona
 * como una "mesa" con su propio número (el que irá en la tarjeta del invitado).
 * El tramo de un asiento se deduce de su posición: no hay que guardar nada en el invitado.
 */

/** Nº de columnas de asientos a lo largo de la mesa (el lado largo con más asientos). */
export function tableColumns(table: TableItem): number {
  if (table.type !== 'rect') return 0
  const sides = table.seatsPerSide ?? defaultSeatsPerSide(table.capacity)
  return Math.max(sides.top, sides.bottom)
}

export function canHaveSections(table: TableItem): boolean {
  return table.type === 'rect' && tableColumns(table) >= 2
}

/**
 * Ajusta los tramos para que sumen exactamente el nº de columnas de la mesa
 * (p. ej. tras cambiar los asientos por lado). Nunca deja tramos vacíos.
 */
export function normalizeSections(table: TableItem): TableSection[] {
  const raw = table.sections ?? []
  if (!raw.length || !canHaveSections(table)) return []
  const cols = tableColumns(table)
  let list = raw.map((s) => ({ ...s, span: Math.max(1, Math.round(s.span) || 1) })).slice(0, cols)
  if (list.length < 2) return []
  let sum = list.reduce((a, s) => a + s.span, 0)
  // sobran columnas: se recortan desde el último tramo hacia atrás
  for (let i = list.length - 1; sum > cols && i >= 0; i--) {
    const cut = Math.min(list[i].span - 1, sum - cols)
    list[i].span -= cut
    sum -= cut
  }
  // faltan columnas: se añaden al último tramo
  if (sum < cols) list[list.length - 1].span += cols - sum
  list = list.filter((s) => s.span > 0)
  return list
}

/** Reparte `count` tramos lo más iguales posible. Las etiquetas se conservan si ya existían. */
export function evenSections(table: TableItem, count: number, labels: string[]): TableSection[] {
  const cols = tableColumns(table)
  const n = Math.max(2, Math.min(count, cols))
  const base = Math.floor(cols / n)
  const extra = cols % n
  return Array.from({ length: n }, (_, i) => ({
    id: table.sections?.[i]?.id ?? createId('section'),
    label: labels[i] ?? String(i + 1),
    span: base + (i < extra ? 1 : 0)
  }))
}

/** Posición X local de cada columna de asientos (igual que en computeSeatPositions). */
function columnX(table: TableItem, i: number, cols: number): number {
  const w = table.width ?? 1.6
  return -w / 2 + (cols === 1 ? 0.5 : i / (cols - 1)) * w
}

export interface SectionRange {
  section: TableSection
  index: number
  /** Límites en X local (metros). El primero y el último se abren hasta ±∞ para incluir las cabeceras. */
  x0: number
  x1: number
  /** Límites "visibles" para dibujar el tramo sobre el cuerpo de la mesa. */
  drawX0: number
  drawX1: number
}

export function sectionRanges(table: TableItem): SectionRange[] {
  const sections = normalizeSections(table)
  if (!sections.length) return []
  const cols = tableColumns(table)
  const w = table.width ?? 1.6
  const out: SectionRange[] = []
  let col = 0
  sections.forEach((section, index) => {
    const first = col
    const last = col + section.span - 1
    col += section.span
    const x0 = index === 0 ? -Infinity : (columnX(table, first - 1, cols) + columnX(table, first, cols)) / 2
    const x1 = index === sections.length - 1 ? Infinity : (columnX(table, last, cols) + columnX(table, last + 1, cols)) / 2
    out.push({ section, index, x0, x1, drawX0: Math.max(-w / 2, x0), drawX1: Math.min(w / 2, x1) })
  })
  return out
}

/** Tramo al que pertenece cada asiento de la mesa (índice de asiento → tramo). */
export function seatSectionMap(table: TableItem): Map<number, SectionRange> {
  const ranges = sectionRanges(table)
  const map = new Map<number, SectionRange>()
  if (!ranges.length) return map
  computeSeatPositions(table, []).forEach((seat) => {
    const r = ranges.find((rg) => seat.x >= rg.x0 && seat.x < rg.x1) ?? ranges[ranges.length - 1]
    map.set(seat.index, r)
  })
  return map
}

export function sectionForSeat(table: TableItem | undefined, seatIndex: number | null): TableSection | null {
  if (!table || seatIndex === null) return null
  return seatSectionMap(table).get(seatIndex)?.section ?? null
}

/** "3" → "Mesa 3"; un nombre libre se deja tal cual. */
export function sectionDisplay(label: string): string {
  const l = label.trim()
  return /^\d+[a-z]?$/i.test(l) ? `Mesa ${l}` : l
}

/**
 * Nombre de la "mesa" de un invitado tal como lo verá él: la submesa si la hay,
 * si no la mesa física. `withParent` añade la mesa física entre paréntesis.
 */
export function guestTableLabel(scenario: Scenario, guest: Pick<Guest, 'tableId' | 'seatIndex'>, withParent = false): string {
  const table = scenario.tables.find((t) => t.id === guest.tableId)
  if (!table) return ''
  const section = sectionForSeat(table, guest.seatIndex)
  if (!section) return table.name
  return withParent ? `${sectionDisplay(section.label)} (${table.name})` : sectionDisplay(section.label)
}

/** Etiquetas numéricas siguientes a la mayor usada en el escenario (numeración global). */
export function nextSectionLabels(scenario: Scenario, count: number, excludeTableId?: string): string[] {
  const used = scenario.tables
    .filter((t) => t.id !== excludeTableId)
    .flatMap((t) => normalizeSections(t).map((s) => parseInt(s.label, 10)))
    .filter((n) => Number.isFinite(n))
  let next = used.length ? Math.max(...used) + 1 : 1
  return Array.from({ length: count }, () => String(next++))
}

/** Asientos (base 1) de un tramo, agrupados por lado: "1–6 y 33–38". */
export function sectionSeatSummary(table: TableItem, sectionId: string): string {
  const seats = [...seatSectionMap(table).entries()].filter(([, r]) => r.section.id === sectionId).map(([i]) => i + 1).sort((a, b) => a - b)
  const runs: string[] = []
  let start = seats[0]
  let prev = seats[0]
  for (let i = 1; i <= seats.length; i++) {
    const n = seats[i]
    if (n === prev + 1) {
      prev = n
      continue
    }
    if (start !== undefined) runs.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = n
    prev = n
  }
  return runs.length > 1 ? `${runs.slice(0, -1).join(', ')} y ${runs[runs.length - 1]}` : runs[0] ?? '—'
}

/** Avisos de etiquetas de submesa repetidas en el escenario. */
export function duplicateSectionLabels(scenario: Scenario): string[] {
  const seen = new Map<string, number>()
  scenario.tables.forEach((t) =>
    normalizeSections(t).forEach((s) => {
      const k = s.label.trim().toLowerCase()
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1)
    })
  )
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
}
