import { jsPDF } from 'jspdf'
import type { Guest, RoomFeature, Scenario, TableItem } from '@/types'
import { computeSeatPositions } from '@/utils/geometry'
import { ALLERGENS, DIETS, dietaryAbbrs, hasDietary, isSevere, SEVERITIES } from '@/utils/dietary'

/**
 * Impresión A4 para wedding planner y catering
 * --------------------------------------------
 * Genera un PDF vectorial (texto seleccionable) dibujando directamente con jsPDF:
 *  1. Plano general de la sala con nombres completos (si caben legibles).
 *  2. Páginas de detalle por mesa, con nombre completo y alergias en cada asiento.
 *     Se añaden automáticamente si en el plano general los nombres no caben a ≥ 6,5 pt.
 *     Si ni así caben, la mesa se reparte en varias páginas con marcas de continuación.
 *  3. Hoja de catering (tabla por mesa con alergias, gravedad y notas).
 *  4. Invitados sin asignar.
 * Todo funciona en blanco y negro: las alergias se marcan con texto y "(!)", no solo con color.
 */

export type PrintOrientation = 'auto' | 'portrait' | 'landscape'

export interface PrintOptions {
  orientation: PrintOrientation
  showDietary: boolean
  includeLegend: boolean
  seatNumbers: boolean
  /** auto = solo si los nombres no caben en el plano general. */
  tableDetail: 'auto' | 'always' | 'never'
  cateringSheet: boolean
  unassignedList: boolean
  title: string
  subtitle: string
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  orientation: 'auto',
  showDietary: true,
  includeLegend: true,
  seatNumbers: true,
  tableDetail: 'auto',
  cateringSheet: true,
  unassignedList: false,
  title: '',
  subtitle: ''
}

export interface PrintInput {
  scenario: Scenario
  /** Invitados con la mesa/asiento del escenario que se imprime. */
  guests: Guest[]
}

export interface PrintReport {
  pages: number
  overviewShowsNames: boolean
  overviewFontPt: number | null
  detailTables: number
  splitTables: string[]
  warnings: string[]
}

// ---------------------------------------------------------------- constantes

const MIN_FONT_PT = 6.5
const MAX_FONT_PT = 10
const PT_TO_MM = 0.3528
const MARGIN = 10
const HEADER_H = 18
const FOOTER_H = 7
const SEVERE_MARK = '(!)'
const INK = 30
const SOFT = 110

// ---------------------------------------------------------------- utilidades

/** jsPDF con Helvetica estándar usa WinAnsi: se sustituyen los caracteres que no puede pintar. */
function pdfText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u0140/g, 'l') // l·l catalana (ŀ) → l
    .replace(/\u013F/g, 'L')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .trim()
}

interface Box { x0: number; y0: number; x1: number; y1: number }

function boxesOverlap(a: Box, b: Box, pad = 0.15): boolean {
  return a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.y0 < b.y1 - pad && a.y1 > b.y0 + pad
}

function unionBox(boxes: Box[]): Box {
  return boxes.reduce(
    (acc, b) => ({ x0: Math.min(acc.x0, b.x0), y0: Math.min(acc.y0, b.y0), x1: Math.max(acc.x1, b.x1), y1: Math.max(acc.y1, b.y1) }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  )
}

/** Divide un nombre en dos líneas lo más equilibradas posible. */
function splitName(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length < 2) return [name]
  let best = 1
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length
    const b = words.slice(i).join(' ').length
    const diff = Math.abs(a - b)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

function rotate(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) }
}

// ---------------------------------------------------------------- modelo de vista

interface ViewSeat {
  index: number
  /** Posición en metros (coordenadas de la vista). */
  x: number
  y: number
  /** Vector unitario hacia fuera de la mesa. */
  dx: number
  dy: number
  guest: Guest | null
  roundTable: boolean
}

interface ViewTable {
  table: TableItem
  /** Polígono de la mesa en metros (coordenadas de la vista). */
  polygon: { x: number; y: number }[]
  circle?: { cx: number; cy: number; r: number }
  center: { x: number; y: number }
}

interface View {
  tables: ViewTable[]
  seats: ViewSeat[]
  features: RoomFeature[]
  /** Rectángulo de la sala a dibujar (solo en el plano general). */
  room?: { w: number; h: number }
  /** Caja en metros que debe caber siempre (sala o mesa). */
  extent: Box
}

function tableGeometry(table: TableItem, guests: Guest[], localRange?: [number, number]): { vt: ViewTable; seats: ViewSeat[] } {
  const rot = table.rotation
  const toRoom = (lx: number, ly: number) => {
    const p = rotate(lx, ly, rot)
    return { x: table.x + p.x, y: table.y + p.y }
  }
  let polygon: { x: number; y: number }[] = []
  let circle: ViewTable['circle']
  if (table.type === 'round') {
    const r = (table.diameter ?? 1.5) / 2
    circle = { cx: table.x, cy: table.y, r }
  } else {
    const w = table.width ?? 1.6
    const l = table.length ?? 0.9
    const x0 = localRange ? Math.max(-w / 2, localRange[0]) : -w / 2
    const x1 = localRange ? Math.min(w / 2, localRange[1]) : w / 2
    polygon = [toRoom(x0, -l / 2), toRoom(x1, -l / 2), toRoom(x1, l / 2), toRoom(x0, l / 2)]
  }
  const local = computeSeatPositions(table, guests)
  const seats: ViewSeat[] = local
    .filter((s) => !localRange || table.type === 'round' || (s.x >= localRange[0] - 1e-6 && s.x <= localRange[1] + 1e-6) ||
      // asientos de las cabeceras (lados cortos): van con el tramo que contiene ese extremo
      ((s.angle === 0 || s.angle === 180) && Math.abs(s.x) > (table.width ?? 1.6) / 2 &&
        ((s.x > 0 && localRange[1] >= (table.width ?? 1.6) / 2 - 1e-6) || (s.x < 0 && localRange[0] <= -(table.width ?? 1.6) / 2 + 1e-6))))
    .map((s) => {
      const p = toRoom(s.x, s.y)
      const a = ((s.angle + rot) * Math.PI) / 180
      return { index: s.index, x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a), guest: s.guest, roundTable: table.type === 'round' }
    })
  return { vt: { table, polygon, circle, center: { x: table.x, y: table.y } }, seats }
}

function tableBox(vt: ViewTable): Box {
  if (vt.circle) {
    const { cx, cy, r } = vt.circle
    return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }
  }
  return unionBox(vt.polygon.map((p) => ({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })))
}

// ---------------------------------------------------------------- etiquetas

interface LabelSpec {
  lines: { text: string; bold: boolean; sizePt: number }[]
}

interface PlacedLabel {
  seat: ViewSeat
  spec: LabelSpec
  /** Caja relativa al punto del asiento, en mm. */
  rel: Box
  rotated: boolean
  align: 'left' | 'right' | 'center'
  /** Dirección vertical para etiquetas centradas o rotadas: -1 arriba, 1 abajo. */
  vdir: number
}

function labelSpec(guest: Guest, fontPt: number, twoLines: boolean, showDietary: boolean): LabelSpec {
  const name = pdfText(guest.fullName)
  const nameLines = twoLines ? splitName(name) : [name]
  const lines = nameLines.map((t) => ({ text: t, bold: guest.isCouple, sizePt: fontPt }))
  if (showDietary && hasDietary(guest.dietary)) {
    const abbrs = dietaryAbbrs(guest.dietary)
    const tag = (isSevere(guest.dietary) ? `${SEVERE_MARK} ` : '') + (abbrs.length ? abbrs.join('·') : 'VER NOTA')
    lines.push({ text: pdfText(tag), bold: true, sizePt: Math.max(MIN_FONT_PT, fontPt * 0.9) })
  }
  return { lines }
}

function lineHeight(pt: number) {
  return pt * PT_TO_MM * 1.12
}

function measureSpec(pdf: jsPDF, spec: LabelSpec): { w: number; h: number } {
  let w = 0
  let h = 0
  spec.lines.forEach((l) => {
    pdf.setFont('helvetica', l.bold ? 'bold' : 'normal')
    pdf.setFontSize(l.sizePt)
    w = Math.max(w, pdf.getTextWidth(l.text))
    h += lineHeight(l.sizePt)
  })
  return { w, h }
}

function placeLabel(pdf: jsPDF, seat: ViewSeat, spec: LabelSpec, dotR: number): PlacedLabel {
  const { w, h } = measureSpec(pdf, spec)
  const gap = dotR + 0.7
  if (seat.roundTable) {
    if (seat.dx > 0.35) return { seat, spec, rel: { x0: gap, y0: -h / 2, x1: gap + w, y1: h / 2 }, rotated: false, align: 'left', vdir: 0 }
    if (seat.dx < -0.35) return { seat, spec, rel: { x0: -gap - w, y0: -h / 2, x1: -gap, y1: h / 2 }, rotated: false, align: 'right', vdir: 0 }
    const vdir = seat.dy < 0 ? -1 : 1
    const y0 = vdir < 0 ? -gap - h : gap
    return { seat, spec, rel: { x0: -w / 2, y0, x1: w / 2, y1: y0 + h }, rotated: false, align: 'center', vdir }
  }
  if (Math.abs(seat.dx) >= Math.abs(seat.dy)) {
    if (seat.dx > 0) return { seat, spec, rel: { x0: gap, y0: -h / 2, x1: gap + w, y1: h / 2 }, rotated: false, align: 'left', vdir: 0 }
    return { seat, spec, rel: { x0: -gap - w, y0: -h / 2, x1: -gap, y1: h / 2 }, rotated: false, align: 'right', vdir: 0 }
  }
  // Lados horizontales de la mesa: texto girado 90° (se lee inclinando la cabeza a la izquierda).
  const vdir = seat.dy < 0 ? -1 : 1
  const y0 = vdir < 0 ? -gap - w : gap
  return { seat, spec, rel: { x0: -h / 2, y0, x1: h / 2, y1: y0 + w }, rotated: true, align: 'left', vdir }
}

// ---------------------------------------------------------------- encaje en página

interface Frame { x0: number; y0: number; x1: number; y1: number }

interface Layout {
  scale: number // mm por metro
  ox: number
  oy: number
  labels: PlacedLabel[]
  dotR: number
  fontPt: number
  twoLines: boolean
  collisions: number
}

function dotRadius(scale: number) {
  return Math.min(2.1, Math.max(1.1, 0.19 * scale))
}

/** Calcula la mayor escala que hace caber sala/mesas + etiquetas en el marco, y cuenta solapes. */
function fitView(pdf: jsPDF, view: View, frame: Frame, fontPt: number | null, twoLines: boolean, showDietary: boolean): Layout {
  const fw = frame.x1 - frame.x0
  const fh = frame.y1 - frame.y0
  const occupied = view.seats.filter((s) => s.guest)

  const labelsFor = (scale: number) =>
    fontPt === null
      ? []
      : occupied.map((s) => placeLabel(pdf, s, labelSpec(s.guest!, fontPt, twoLines, showDietary), dotRadius(scale)))

  const extentAt = (scale: number, labels: PlacedLabel[]) => {
    const boxes: Box[] = [
      { x0: view.extent.x0 * scale, y0: view.extent.y0 * scale, x1: view.extent.x1 * scale, y1: view.extent.y1 * scale }
    ]
    labels.forEach((l) => {
      boxes.push({ x0: l.seat.x * scale + l.rel.x0, y0: l.seat.y * scale + l.rel.y0, x1: l.seat.x * scale + l.rel.x1, y1: l.seat.y * scale + l.rel.y1 })
    })
    view.seats.forEach((s) => {
      const r = dotRadius(scale)
      boxes.push({ x0: s.x * scale - r, y0: s.y * scale - r, x1: s.x * scale + r, y1: s.y * scale + r })
    })
    return unionBox(boxes)
  }

  // búsqueda binaria de la escala máxima que cabe
  let lo = 0.5
  let hi = 80
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const e = extentAt(mid, labelsFor(mid))
    if (e.x1 - e.x0 <= fw && e.y1 - e.y0 <= fh) lo = mid
    else hi = mid
  }
  const scale = lo
  const labels = labelsFor(scale)
  const e = extentAt(scale, labels)
  const ox = frame.x0 + (fw - (e.x1 - e.x0)) / 2 - e.x0
  const oy = frame.y0 + (fh - (e.y1 - e.y0)) / 2 - e.y0
  const dotR = dotRadius(scale)

  // solapes: etiqueta-etiqueta, etiqueta-mesa, etiqueta-asiento ajeno
  const abs = labels.map((l) => ({ x0: l.seat.x * scale + l.rel.x0, y0: l.seat.y * scale + l.rel.y0, x1: l.seat.x * scale + l.rel.x1, y1: l.seat.y * scale + l.rel.y1 }))
  const tBoxes = view.tables.map((t) => {
    const b = tableBox(t)
    return { x0: b.x0 * scale, y0: b.y0 * scale, x1: b.x1 * scale, y1: b.y1 * scale }
  })
  const seatBoxes = view.seats.map((s) => ({ seat: s, box: { x0: s.x * scale - dotR, y0: s.y * scale - dotR, x1: s.x * scale + dotR, y1: s.y * scale + dotR } }))
  let collisions = 0
  for (let i = 0; i < abs.length; i++) {
    for (let j = i + 1; j < abs.length; j++) if (boxesOverlap(abs[i], abs[j], -0.6)) collisions++
    // con mesas: usar la caja exacta solo para mesas no giradas en diagonal
    view.tables.forEach((t, k) => {
      const rotOk = t.circle || t.table.rotation % 90 === 0
      if (rotOk && boxesOverlap(abs[i], tBoxes[k], 0.3)) collisions++
    })
    seatBoxes.forEach((sb) => {
      if (sb.seat !== labels[i].seat && boxesOverlap(abs[i], sb.box, 0.2)) collisions++
    })
  }
  return { scale, ox, oy, labels, dotR, fontPt: fontPt ?? 0, twoLines, collisions }
}

/** Prueba de mayor a menor tamaño de letra, primero en una línea y luego en dos. */
function bestLayout(pdf: jsPDF, view: View, frame: Frame, showDietary: boolean): Layout | null {
  for (let pt = MAX_FONT_PT; pt >= MIN_FONT_PT - 1e-6; pt -= 0.5) {
    for (const two of [false, true]) {
      const layout = fitView(pdf, view, frame, pt, two, showDietary)
      if (layout.collisions === 0) return layout
    }
  }
  return null
}

// ---------------------------------------------------------------- dibujo

function drawView(pdf: jsPDF, view: View, layout: Layout, opts: { names: boolean; seatNumbers: boolean; showDietary: boolean; tableLabels: boolean }) {
  const { scale, ox, oy, dotR } = layout
  const P = (x: number, y: number) => ({ x: ox + x * scale, y: oy + y * scale })

  if (view.room) {
    const a = P(0, 0)
    pdf.setDrawColor(150)
    pdf.setLineWidth(0.35)
    pdf.rect(a.x, a.y, view.room.w * scale, view.room.h * scale)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(SOFT)
    pdf.text(`${view.room.w} m × ${view.room.h} m`.replace('×', 'x'), a.x + view.room.w * scale, a.y + view.room.h * scale + 3, { align: 'right' })
  }

  // elementos de la sala (puerta, DJ, barra...)
  view.features.forEach((f) => {
    const p = P(f.x, f.y)
    const label = pdfText(f.label || f.type)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    const w = pdf.getTextWidth(label) + 3
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(120)
    pdf.setLineWidth(0.25)
    pdf.roundedRect(p.x - w / 2, p.y - 2.2, w, 4.4, 1, 1, 'FD')
    pdf.setTextColor(INK)
    pdf.text(label, p.x, p.y + 0.9, { align: 'center' })
  })

  // mesas
  view.tables.forEach((vt) => {
    pdf.setDrawColor(90)
    pdf.setFillColor(236, 232, 222)
    pdf.setLineWidth(0.3)
    if (vt.circle) {
      const c = P(vt.circle.cx, vt.circle.cy)
      pdf.circle(c.x, c.y, vt.circle.r * scale, 'FD')
    } else {
      const pts = vt.polygon.map((p) => P(p.x, p.y))
      pdf.lines(pts.slice(1).map((p, i) => [p.x - pts[i].x, p.y - pts[i].y]), pts[0].x, pts[0].y, [1, 1], 'FD', true)
    }
    if (opts.tableLabels) {
      const c = P(vt.center.x, vt.center.y)
      const b = tableBox(vt)
      const vertical = (b.y1 - b.y0) > (b.x1 - b.x0) * 1.5
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(INK)
      const name = pdfText(vt.table.name)
      if (vertical) pdf.text(name, c.x + 1.3, c.y + pdf.getTextWidth(name) / 2, { angle: 90 })
      else pdf.text(name, c.x, c.y + 1.3, { align: 'center' })
    }
  })

  // asientos
  view.seats.forEach((s) => {
    const p = P(s.x, s.y)
    const severe = s.guest && opts.showDietary && isSevere(s.guest.dietary)
    const diet = s.guest && opts.showDietary && hasDietary(s.guest.dietary)
    pdf.setLineWidth(severe ? 0.5 : 0.25)
    pdf.setDrawColor(severe ? 0 : 90)
    if (s.guest) pdf.setFillColor(diet ? 40 : 255, diet ? 40 : 255, diet ? 40 : 255)
    else pdf.setFillColor(255, 255, 255)
    pdf.circle(p.x, p.y, dotR, s.guest ? 'FD' : 'D')
    if (opts.seatNumbers) {
      const n = String(s.index + 1)
      const size = Math.min(6, Math.max(3.6, (dotR * 2 * 0.62) / PT_TO_MM / (n.length > 1 ? 1.15 : 0.9)))
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(size)
      pdf.setTextColor(diet ? 255 : s.guest ? INK : 160)
      pdf.text(n, p.x, p.y + size * PT_TO_MM * 0.35, { align: 'center' })
    }
  })

  if (!opts.names) return

  // nombres (texto en negro: legible en impresión B/N; novios en negrita)
  layout.labels.forEach((l) => {
    const p = P(l.seat.x, l.seat.y)
    const heights = l.spec.lines.map((ln) => lineHeight(ln.sizePt))
    pdf.setTextColor(INK)
    if (!l.rotated) {
      let y = p.y + l.rel.y0
      l.spec.lines.forEach((ln, i) => {
        pdf.setFont('helvetica', ln.bold ? 'bold' : 'normal')
        pdf.setFontSize(ln.sizePt)
        const x = l.align === 'left' ? p.x + l.rel.x0 : l.align === 'right' ? p.x + l.rel.x1 : p.x
        pdf.text(ln.text, x, y + heights[i] * 0.78, { align: l.align })
        y += heights[i]
      })
    } else {
      // Texto girado 90°: la línea base sube y los glifos quedan a su izquierda.
      // Encima de la mesa empieza junto al asiento y sube; debajo termina junto al asiento.
      let x = p.x + l.rel.x0
      l.spec.lines.forEach((ln, i) => {
        pdf.setFont('helvetica', ln.bold ? 'bold' : 'normal')
        pdf.setFontSize(ln.sizePt)
        const w = pdf.getTextWidth(ln.text)
        const anchorY = l.vdir < 0 ? p.y + l.rel.y1 : p.y + l.rel.y0 + w
        pdf.text(ln.text, x + heights[i] * 0.78, anchorY, { angle: 90 })
        x += heights[i]
      })
    }
  })
}

// ---------------------------------------------------------------- páginas

interface PageCtx {
  pdf: jsPDF
  options: PrintOptions
  pageTitle: string
}

function pageSize(pdf: jsPDF) {
  return { w: pdf.internal.pageSize.getWidth(), h: pdf.internal.pageSize.getHeight() }
}

function drawHeader(ctx: PageCtx, section: string) {
  const { pdf, options } = ctx
  const { w } = pageSize(pdf)
  pdf.setTextColor(INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(pdfText(options.title || 'Seating plan'), MARGIN, MARGIN + 4)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(pdfText(section), w - MARGIN, MARGIN + 4, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(SOFT)
  pdf.text(pdfText(options.subtitle), MARGIN, MARGIN + 9)
  pdf.setDrawColor(190)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN, MARGIN + 11.5, w - MARGIN, MARGIN + 11.5)
}

function contentFrame(pdf: jsPDF, bottomReserve = 0): Frame {
  const { w, h } = pageSize(pdf)
  return { x0: MARGIN, y0: MARGIN + HEADER_H, x1: w - MARGIN, y1: h - MARGIN - FOOTER_H - bottomReserve }
}

function newPage(pdf: jsPDF, first: { value: boolean }, orientation: 'portrait' | 'landscape') {
  if (first.value) {
    first.value = false
    // la primera página ya existe; si la orientación no coincide se cambia
    const { w, h } = pageSize(pdf)
    if ((orientation === 'landscape') !== (w > h)) {
      pdf.deletePage(1)
      pdf.addPage('a4', orientation)
    }
  } else {
    pdf.addPage('a4', orientation)
  }
}

/** Abreviaturas usadas por los invitados dados, para la leyenda. */
function legendItems(guests: Guest[]) {
  const items: { abbr: string; label: string }[] = []
  ALLERGENS.forEach((a) => {
    if (guests.some((g) => g.dietary.allergens.includes(a.code))) items.push({ abbr: a.abbr, label: a.label })
  })
  DIETS.forEach((d) => {
    if (guests.some((g) => g.dietary.diets.includes(d.code))) items.push({ abbr: d.abbr, label: d.label })
  })
  if (guests.some((g) => hasDietary(g.dietary) && g.dietary.allergens.length === 0 && g.dietary.diets.length === 0)) {
    items.push({ abbr: 'VER NOTA', label: 'ver hoja de catering' })
  }
  return items
}

function legendHeight(pdf: jsPDF, guests: Guest[], show: boolean): number {
  if (!show) return 0
  const items = legendItems(guests)
  if (!items.length && !guests.some((g) => isSevere(g.dietary))) return 0
  const { w } = pageSize(pdf)
  const text = legendText(guests)
  pdf.setFontSize(7)
  const lines = pdf.splitTextToSize(text, w - MARGIN * 2 - 4)
  return lines.length * lineHeight(7) + 5
}

function legendText(guests: Guest[]): string {
  const items = legendItems(guests)
  const parts = items.map((i) => `${i.abbr} = ${i.label}`)
  parts.unshift(`${SEVERE_MARK} = alergia grave (evitar también trazas) · asiento relleno = tiene restricción`)
  return pdfText(parts.join('   ·   '))
}

function drawLegend(pdf: jsPDF, guests: Guest[]) {
  const { w, h } = pageSize(pdf)
  const height = legendHeight(pdf, guests, true)
  if (!height) return
  const y0 = h - MARGIN - FOOTER_H - height + 1
  pdf.setDrawColor(190)
  pdf.setFillColor(248, 246, 241)
  pdf.setLineWidth(0.25)
  pdf.rect(MARGIN, y0, w - MARGIN * 2, height - 1.5, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(INK)
  const lines = pdf.splitTextToSize(legendText(guests), w - MARGIN * 2 - 4)
  pdf.text(lines, MARGIN + 2, y0 + 3.6)
}

function chooseOrientation(option: PrintOrientation, wMeters: number, hMeters: number): 'portrait' | 'landscape' {
  if (option !== 'auto') return option
  return wMeters > hMeters * 1.05 ? 'landscape' : 'portrait'
}

// ---------------------------------------------------------------- generador principal

export function buildSeatingPdf(input: PrintInput, options: PrintOptions): { pdf: jsPDF; report: PrintReport } {
  const { scenario, guests } = input
  const report: PrintReport = { pages: 0, overviewShowsNames: false, overviewFontPt: null, detailTables: 0, splitTables: [], warnings: [] }
  const seatedGuests = guests.filter((g) => g.tableId && scenario.tables.some((t) => t.id === g.tableId))
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  pdf.setProperties({ title: `${options.title} - ${scenario.name}`, creator: 'Seating Plan' })
  const first = { value: true }
  const ctx: PageCtx = { pdf, options, pageTitle: scenario.name }

  // ---------- 1. plano general
  const room = scenario.room
  const overviewOrientation = chooseOrientation(options.orientation, room.widthMeters, room.heightMeters)
  newPage(pdf, first, overviewOrientation)
  drawHeader(ctx, `Plano general · ${scenario.name}`)

  const overviewTables = scenario.tables.map((t) => tableGeometry(t, seatedGuests))
  const overview: View = {
    tables: overviewTables.map((g) => g.vt),
    seats: overviewTables.flatMap((g) => g.seats),
    features: scenario.roomFeatures,
    room: { w: room.widthMeters, h: room.heightMeters },
    extent: { x0: 0, y0: 0, x1: room.widthMeters, y1: room.heightMeters }
  }
  const legendReserve = options.showDietary ? legendHeight(pdf, seatedGuests, options.includeLegend) : 0
  const frame = contentFrame(pdf, legendReserve)
  const withNames = options.tableDetail === 'always' ? null : bestLayout(pdf, overview, frame, options.showDietary)
  const needDetail = options.tableDetail === 'always' || (options.tableDetail === 'auto' && !withNames)

  if (withNames) {
    report.overviewShowsNames = true
    report.overviewFontPt = withNames.fontPt
    drawView(pdf, overview, withNames, { names: true, seatNumbers: options.seatNumbers, showDietary: options.showDietary, tableLabels: true })
  } else {
    const plain = fitView(pdf, overview, frame, null, false, options.showDietary)
    drawView(pdf, overview, plain, { names: false, seatNumbers: true, showDietary: options.showDietary, tableLabels: true })
    if (options.tableDetail === 'never') {
      report.warnings.push('Los nombres no caben legibles (≥ 6,5 pt) en el plano general y has desactivado las páginas por mesa: el plano solo muestra números de asiento.')
    }
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8)
    pdf.setTextColor(SOFT)
    pdf.text(
      needDetail
        ? 'Plano con números de asiento. Los nombres completos están en las páginas siguientes (una por mesa).'
        : 'Plano con números de asiento.',
      frame.x0,
      frame.y0 - 1
    )
  }
  if (options.showDietary && options.includeLegend) drawLegend(pdf, seatedGuests)

  // ---------- 2. detalle por mesa
  if (needDetail) {
    scenario.tables.forEach((table) => {
      const occupants = seatedGuests.filter((g) => g.tableId === table.id)
      if (!occupants.length && options.tableDetail !== 'always') return
      report.detailTables++
      const whole = tableGeometry(table, seatedGuests)
      const b = tableBox(whole.vt)
      const seatsBox = unionBox(whole.seats.map((s) => ({ x0: s.x, y0: s.y, x1: s.x, y1: s.y })))
      const ext = unionBox([b, seatsBox])
      const orient = chooseOrientation(options.orientation === 'auto' ? 'auto' : options.orientation, ext.x1 - ext.x0, ext.y1 - ext.y0)

      // ¿cabe entera? si no, se parte a lo largo del lado largo (solo mesas rectangulares)
      const tryChunks = table.type === 'rect' ? [1, 2, 3, 4, 5, 6] : [1]
      let chosen: { views: View[]; layouts: Layout[] } | null = null
      for (const k of tryChunks) {
        const w = table.width ?? 1.6
        const ranges: [number, number][] = Array.from({ length: k }, (_, i) => [-w / 2 + (w * i) / k, -w / 2 + (w * (i + 1)) / k])
        const views = ranges.map((r) => {
          const g = k === 1 ? whole : tableGeometry(table, seatedGuests, r)
          const tb = tableBox(g.vt)
          const sb = g.seats.length ? unionBox(g.seats.map((s) => ({ x0: s.x, y0: s.y, x1: s.x, y1: s.y }))) : tb
          return { tables: [g.vt], seats: g.seats, features: [], extent: unionBox([tb, sb]) } as View
        })
        // medir en una página de prueba con la orientación elegida
        const probe = new jsPDF({ unit: 'mm', format: 'a4', orientation: orient })
        const f = contentFrame(probe, options.showDietary && options.includeLegend ? legendHeight(probe, occupants, true) : 0)
        const layouts = views.map((v) => bestLayout(probe, v, f, options.showDietary))
        if (layouts.every((l) => l)) {
          chosen = { views, layouts: layouts as Layout[] }
          break
        }
      }
      if (!chosen) {
        // último recurso: tamaño mínimo aunque haya solapes, avisando
        const f = contentFrame(pdf)
        chosen = { views: [{ tables: [whole.vt], seats: whole.seats, features: [], extent: ext }], layouts: [fitView(pdf, { tables: [whole.vt], seats: whole.seats, features: [], extent: ext }, f, MIN_FONT_PT, true, options.showDietary)] }
        report.warnings.push(`${table.name}: hay demasiados asientos para que todos los nombres quepan sin solaparse.`)
      }
      if (chosen.views.length > 1) report.splitTables.push(table.name)

      chosen.views.forEach((view, i) => {
        newPage(pdf, first, orient)
        const seatsHere = view.seats.map((s) => s.index + 1).sort((a, b) => a - b)
        const range = chosen!.views.length > 1 ? ` · parte ${i + 1}/${chosen!.views.length} (asientos ${compactRanges(seatsHere)})` : ''
        drawHeader(ctx, `${table.name}${range}`)
        const legendGuests = view.seats.filter((s) => s.guest).map((s) => s.guest!)
        const f = contentFrame(pdf, options.showDietary && options.includeLegend ? legendHeight(pdf, legendGuests, true) : 0)
        const layout = bestLayout(pdf, view, f, options.showDietary) ?? chosen!.layouts[i]
        drawView(pdf, view, layout, { names: true, seatNumbers: options.seatNumbers, showDietary: options.showDietary, tableLabels: true })
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(SOFT)
        const occ = view.seats.filter((s) => s.guest).length
        const note = `${occ} invitado(s) en esta página · orientación igual que en el plano general${chosen!.views.length > 1 && i < chosen!.views.length - 1 ? ' · continúa en la página siguiente' : ''}`
        pdf.text(pdfText(note), f.x0, f.y0 - 1)
        if (options.showDietary && options.includeLegend) drawLegend(pdf, legendGuests)
      })
    })
  }

  // ---------- 3. hoja de catering
  if (options.cateringSheet) drawCateringSheet(pdf, ctx, scenario, guests, first)

  // ---------- 4. sin asignar
  if (options.unassignedList) drawUnassigned(pdf, ctx, scenario, guests, first)

  // ---------- pies de página
  const total = pdf.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i)
    const { w, h } = pageSize(pdf)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(SOFT)
    pdf.text(`Página ${i} de ${total}`, w - MARGIN, h - MARGIN + 1, { align: 'right' })
    pdf.text(pdfText(`Impreso el ${new Date().toLocaleDateString('es-ES')} · escenario «${scenario.name}»`).replace(/[«»]/g, '"'), MARGIN, h - MARGIN + 1)
  }
  report.pages = total
  return { pdf, report }
}

function compactRanges(nums: number[]): string {
  const out: string[] = []
  let start = nums[0]
  let prev = nums[0]
  for (let i = 1; i <= nums.length; i++) {
    const n = nums[i]
    if (n === prev + 1) {
      prev = n
      continue
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = n
    prev = n
  }
  return out.join(', ')
}

// ---------------------------------------------------------------- hoja de catering

interface Col { title: string; width: number }

function drawCateringSheet(pdf: jsPDF, ctx: PageCtx, scenario: Scenario, guests: Guest[], first: { value: boolean }) {
  newPage(pdf, first, 'portrait')
  drawHeader(ctx, 'Hoja de catering · alergias y dietas')
  const frame = contentFrame(pdf)
  let y = frame.y0

  const relevant = guests.filter((g) => g.status !== 'rechazado' && hasDietary(g.dietary))
  const tableOrder = new Map(scenario.tables.map((t, i) => [t.id, i]))
  const tableName = new Map(scenario.tables.map((t) => [t.id, t.name]))
  const sorted = [...relevant].sort((a, b) => {
    const ta = a.tableId && tableOrder.has(a.tableId) ? tableOrder.get(a.tableId)! : 9999
    const tb = b.tableId && tableOrder.has(b.tableId) ? tableOrder.get(b.tableId)! : 9999
    if (ta !== tb) return ta - tb
    return (a.seatIndex ?? 999) - (b.seatIndex ?? 999)
  })

  // resumen
  pdf.setTextColor(INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(`${relevant.length} invitado(s) con alergias, intolerancias o dietas`, frame.x0, y + 4)
  y += 8
  pdf.setFontSize(8.5)
  const perTable = [...scenario.tables.map((t) => t.id), null].map((tid) => {
    const list = relevant.filter((g) => (tid ? g.tableId === tid : !g.tableId || !tableOrder.has(g.tableId)))
    if (!list.length) return null
    const counts = new Map<string, number>()
    list.forEach((g) => {
      const tags = dietaryAbbrs(g.dietary)
      ;(tags.length ? tags : ['VER NOTA']).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1))
    })
    const severe = list.filter((g) => isSevere(g.dietary)).length
    const detail = [...counts.entries()].map(([k, v]) => `${v} ${k}`).join(', ')
    return `${tid ? tableName.get(tid) : 'Sin mesa'}: ${list.length} (${detail})${severe ? ` · ${severe} ${SEVERE_MARK} alergia grave` : ''}`
  }).filter(Boolean) as string[]
  pdf.setFont('helvetica', 'normal')
  perTable.forEach((line) => {
    const wrapped = pdf.splitTextToSize(pdfText(line), frame.x1 - frame.x0)
    pdf.text(wrapped, frame.x0, y + 3)
    y += wrapped.length * lineHeight(8.5) + 0.8
  })
  y += 3

  if (!relevant.length) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(SOFT)
    pdf.text('No hay alergias ni dietas registradas.', frame.x0, y + 4)
    return
  }

  const cols: Col[] = [
    { title: 'Mesa', width: 20 },
    { title: 'Asiento', width: 13 },
    { title: 'Invitado', width: 47 },
    { title: 'Alergias / dietas', width: 40 },
    { title: 'Gravedad', width: 20 },
    { title: 'Notas', width: frame.x1 - frame.x0 - 140 }
  ]
  const FS = 8.5
  const LH = lineHeight(FS)

  const drawHead = () => {
    pdf.setFillColor(60, 60, 60)
    pdf.rect(frame.x0, y, frame.x1 - frame.x0, 6, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(255, 255, 255)
    let x = frame.x0
    cols.forEach((c) => {
      pdf.text(c.title, x + 1.5, y + 4.1)
      x += c.width
    })
    y += 6
  }
  drawHead()

  let prevTable: string | null | undefined
  sorted.forEach((g, idx) => {
    const severe = isSevere(g.dietary)
    const sev = g.dietary.severity ? SEVERITIES.find((s) => s.code === g.dietary.severity)!.label : '—'
    const tags = dietaryAbbrs(g.dietary)
    const labels = [...ALLERGENS.filter((a) => g.dietary.allergens.includes(a.code)).map((a) => a.label), ...DIETS.filter((d) => g.dietary.diets.includes(d.code)).map((d) => d.label)]
    const cells = [
      g.tableId && tableName.get(g.tableId) ? tableName.get(g.tableId)! : 'Sin mesa',
      g.seatIndex !== null && g.tableId ? String(g.seatIndex + 1) : '—',
      g.fullName,
      labels.length ? `${tags.join('·')}\n${labels.join(', ')}` : '—',
      severe ? `${SEVERE_MARK} ${sev}` : sev,
      g.dietary.notes || ''
    ]
    pdf.setFontSize(FS)
    const wrapped = cells.map((c, i) => {
      pdf.setFont('helvetica', i === 2 || (i === 4 && severe) ? 'bold' : 'normal')
      // cada línea se sanea por separado para conservar los saltos de línea intencionados
      return c.split('\n').flatMap((part) => pdf.splitTextToSize(pdfText(part), cols[i].width - 3) as string[])
    })
    const rowH = Math.max(...wrapped.map((w) => w.length)) * LH + 2.4
    if (y + rowH > frame.y1) {
      pdf.addPage('a4', 'portrait')
      drawHeader(ctx, 'Hoja de catering (continuación)')
      y = frame.y0
      drawHead()
    }
    const tableKey = g.tableId ?? null
    if (prevTable !== undefined && tableKey !== prevTable) {
      pdf.setDrawColor(60)
      pdf.setLineWidth(0.5)
      pdf.line(frame.x0, y, frame.x1, y)
    }
    prevTable = tableKey
    if (idx % 2 === 1) {
      pdf.setFillColor(245, 243, 238)
      pdf.rect(frame.x0, y, frame.x1 - frame.x0, rowH, 'F')
    }
    if (severe) {
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.8)
      pdf.line(frame.x0 + 0.4, y + 0.4, frame.x0 + 0.4, y + rowH - 0.4)
    }
    let x = frame.x0
    wrapped.forEach((lines, i) => {
      pdf.setFont('helvetica', i === 2 || (i === 4 && severe) || (i === 3 && severe) ? 'bold' : 'normal')
      pdf.setTextColor(INK)
      pdf.text(lines, x + 1.5, y + 1.2 + LH * 0.8)
      x += cols[i].width
    })
    pdf.setDrawColor(215)
    pdf.setLineWidth(0.2)
    pdf.line(frame.x0, y + rowH, frame.x1, y + rowH)
    y += rowH
  })

  y += 4
  if (y + 8 < frame.y1) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(SOFT)
    pdf.text(pdfText(`${SEVERE_MARK} = alergia grave: evitar también trazas y contaminación cruzada. Asiento numerado como en el plano.`), frame.x0, y + 3)
  }
}

// ---------------------------------------------------------------- sin asignar

function drawUnassigned(pdf: jsPDF, ctx: PageCtx, scenario: Scenario, guests: Guest[], first: { value: boolean }) {
  newPage(pdf, first, 'portrait')
  drawHeader(ctx, 'Invitados sin mesa asignada')
  const frame = contentFrame(pdf)
  const tableIds = new Set(scenario.tables.map((t) => t.id))
  const list = guests
    .filter((g) => g.status !== 'rechazado' && (!g.tableId || !tableIds.has(g.tableId)))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
  let y = frame.y0 + 4
  pdf.setTextColor(INK)
  if (!list.length) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.text('Todos los invitados confirmados o pendientes tienen mesa.', frame.x0, y)
    return
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const colW = (frame.x1 - frame.x0) / 2
  list.forEach((g, i) => {
    const col = i % 2
    if (col === 0 && i > 0) y += lineHeight(9) + 1.2
    if (y > frame.y1) {
      pdf.addPage('a4', 'portrait')
      drawHeader(ctx, 'Invitados sin mesa (continuación)')
      y = frame.y0 + 4
    }
    const status = g.status === 'pendiente' ? ' (pendiente)' : ''
    const diet = hasDietary(g.dietary) ? ` · ${dietaryAbbrs(g.dietary).join('·') || 'ver nota'}` : ''
    pdf.text(pdfText(`• ${g.fullName}${status}${diet}`), frame.x0 + col * colW, y)
  })
}
