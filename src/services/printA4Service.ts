import { jsPDF } from 'jspdf'
import type { Guest, RoomFeature, Scenario, TableItem } from '@/types'
import { computeSeatPositions } from '@/utils/geometry'
import { ALLERGENS, DIETS, dietaryAbbrs, dietaryTags, hasDietary, isBaby, isSevere, SEVERITIES, GIFT_ICON, GIFT_COLOR } from '@/utils/dietary'

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
  /** Hoja aparte con la lista de regalos por mesa y asiento. */
  giftSheet: boolean
  title: string
  subtitle: string
  /** Texto del pie de página (p. ej. "Els Calderers · 17/10/2026"). */
  footer: string
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  orientation: 'auto',
  showDietary: true,
  includeLegend: true,
  seatNumbers: true,
  tableDetail: 'auto',
  cateringSheet: true,
  unassignedList: false,
  giftSheet: true,
  title: '',
  subtitle: '',
  footer: ''
}

export interface PrintInput {
  scenario: Scenario
  /** Invitados con la mesa/asiento del escenario que se imprime. */
  guests: Guest[]
  /**
   * Miniaturas PNG (data URL) de los iconos, por código de categoría y 'gift'.
   * En el navegador se generan con el mismo emoji que se ve en pantalla.
   * Si falta alguna, se dibuja un círculo del color de la categoría.
   */
  icons?: Record<string, string>
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
/** Rojo de los novios (igual que en la app). */
const COUPLE_RGB: [number, number, number] = [179, 38, 30]

/** Iconos del PDF en curso (se fijan al empezar buildSeatingPdf). */
let ICONS: Record<string, string> = {}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mezcla un color con blanco (amount = proporción de color). */
function tint(hex: string, amount: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [Math.round(255 - (255 - r) * amount), Math.round(255 - (255 - g) * amount), Math.round(255 - (255 - b) * amount)]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Dibuja la miniatura de una categoría; si no hay imagen, un círculo de su color. */
function drawIcon(pdf: jsPDF, code: string, color: string, x: number, y: number, size: number) {
  const img = ICONS[code]
  if (img) {
    try {
      pdf.addImage(img, 'PNG', x, y, size, size, `icon-${code}`, 'FAST')
      return
    } catch {
      /* imagen no válida: se usa el círculo */
    }
  }
  pdf.setFillColor(...hexToRgb(color))
  pdf.circle(x + size / 2, y + size / 2, size * 0.4, 'F')
}

/** Disco dividido en sectores de colores (asiento con varias categorías). */
function drawPie(pdf: jsPDF, cx: number, cy: number, r: number, colors: string[]) {
  if (colors.length === 1) {
    pdf.setFillColor(...hexToRgb(colors[0]))
    pdf.circle(cx, cy, r, 'F')
    return
  }
  const n = colors.length
  colors.forEach((c, i) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
    const steps = Math.max(4, Math.ceil(24 / n))
    const pts: [number, number][] = [[cx, cy]]
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
    const segs = pts.slice(1).map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]])
    pdf.setFillColor(...hexToRgb(c))
    pdf.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true)
  })
}

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

interface TagItem {
  code: string
  text: string
  color: string
}

type LabelLine =
  | { kind: 'text'; text: string; bold: boolean; sizePt: number; couple: boolean }
  | { kind: 'tags'; items: TagItem[]; severe: boolean; sizePt: number }

interface LabelSpec {
  lines: LabelLine[]
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

function guestTagItems(guest: Guest, showDietary: boolean): TagItem[] {
  const items: TagItem[] = []
  if (showDietary) {
    dietaryTags(guest.dietary).forEach((t) => items.push({ code: t.code, text: pdfText(t.abbr), color: t.color }))
    if (hasDietary(guest.dietary) && items.length === 0) items.push({ code: 'nota', text: 'VER NOTA', color: '#888888' })
  }
  if (guest.gift) items.push({ code: 'gift', text: '', color: GIFT_COLOR })
  return items
}

function labelSpec(guest: Guest, fontPt: number, twoLines: boolean, showDietary: boolean): LabelSpec {
  const name = pdfText(guest.fullName)
  const nameLines = twoLines ? splitName(name) : [name]
  const lines: LabelLine[] = nameLines.map((t) => ({ kind: 'text', text: t, bold: guest.isCouple, sizePt: fontPt, couple: guest.isCouple }))
  const items = guestTagItems(guest, showDietary)
  if (items.length) {
    lines.push({ kind: 'tags', items, severe: showDietary && isSevere(guest.dietary), sizePt: Math.max(MIN_FONT_PT, fontPt * 0.85) })
  }
  return { lines }
}

function lineHeight(pt: number) {
  return pt * PT_TO_MM * 1.12
}

/** Alto de la fila de etiquetas (algo mayor que el texto para que quepa la miniatura). */
function tagLineHeight(pt: number) {
  return pt * PT_TO_MM * 1.45
}

function lineH(line: LabelLine) {
  return line.kind === 'tags' ? tagLineHeight(line.sizePt) : lineHeight(line.sizePt)
}

const CHIP_PAD = 0.5
const CHIP_GAP = 0.6

/** Ancho de cada etiqueta (icono + abreviatura) y del conjunto. */
function measureTags(pdf: jsPDF, line: Extract<LabelLine, { kind: 'tags' }>): { widths: number[]; severeW: number; total: number } {
  const h = tagLineHeight(line.sizePt)
  const icon = h - 0.6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(line.sizePt)
  const widths = line.items.map((it) => CHIP_PAD * 2 + icon + (it.text ? 0.4 + pdf.getTextWidth(it.text) : 0))
  const severeW = line.severe ? pdf.getTextWidth(SEVERE_MARK) + CHIP_GAP : 0
  const total = severeW + widths.reduce((a, b) => a + b, 0) + CHIP_GAP * Math.max(0, widths.length - 1)
  return { widths, severeW, total }
}

function measureSpec(pdf: jsPDF, spec: LabelSpec): { w: number; h: number } {
  let w = 0
  let h = 0
  spec.lines.forEach((l) => {
    if (l.kind === 'text') {
      pdf.setFont('helvetica', l.bold ? 'bold' : 'normal')
      pdf.setFontSize(l.sizePt)
      w = Math.max(w, pdf.getTextWidth(l.text))
    } else {
      w = Math.max(w, measureTags(pdf, l).total)
    }
    h += lineH(l)
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

  // asientos: color de cada categoría (dividido si hay varias), trona para bebés, aro rojo para los novios
  view.seats.forEach((s) => {
    const p = P(s.x, s.y)
    const colors = s.guest && opts.showDietary ? dietaryTags(s.guest.dietary).map((t) => t.color) : []
    const baby = !!s.guest && isBaby(s.guest.dietary)
    if (baby) {
      // trona: cuadrado redondeado (con franjas si tiene más categorías)
      const side = dotR * 1.9
      const x0 = p.x - side / 2
      const y0 = p.y - side / 2
      const fills = colors.length ? colors : ['#FFFFFF']
      fills.forEach((c, i) => {
        pdf.setFillColor(...hexToRgb(c))
        pdf.rect(x0 + (side * i) / fills.length, y0, side / fills.length, side, 'F')
      })
      pdf.setDrawColor(60)
      pdf.setLineWidth(0.35)
      pdf.roundedRect(x0, y0, side, side, 0.5, 0.5, 'D')
    } else {
      if (colors.length) drawPie(pdf, p.x, p.y, dotR, colors)
      else {
        pdf.setFillColor(255, 255, 255)
        pdf.circle(p.x, p.y, dotR, 'F')
      }
      const severe = s.guest && opts.showDietary && isSevere(s.guest.dietary)
      pdf.setLineWidth(severe ? 0.5 : 0.25)
      pdf.setDrawColor(severe ? 0 : s.guest ? 90 : 160)
      pdf.circle(p.x, p.y, dotR, 'D')
    }
    if (s.guest?.isCouple) {
      pdf.setDrawColor(...COUPLE_RGB)
      pdf.setLineWidth(0.55)
      pdf.circle(p.x, p.y, dotR + 0.45, 'D')
    }
    if (opts.seatNumbers) {
      const n = String(s.index + 1)
      const size = Math.min(6, Math.max(3.6, (dotR * 2 * 0.62) / PT_TO_MM / (n.length > 1 ? 1.15 : 0.9)))
      const avgLum = colors.length ? colors.reduce((a, c) => a + luminance(c), 0) / colors.length : 1
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(size)
      if (avgLum < 0.5) pdf.setTextColor(255, 255, 255)
      else pdf.setTextColor(s.guest ? INK : 160)
      pdf.text(n, p.x, p.y + size * PT_TO_MM * 0.35, { align: 'center' })
    }
    // en el plano sin nombres, el regalo se marca junto al asiento
    if (!opts.names && s.guest?.gift) {
      const size = Math.max(2.2, dotR * 1.4)
      const gx = p.x + s.dx * (dotR + size * 0.75) - size / 2
      const gy = p.y + s.dy * (dotR + size * 0.75) - size / 2
      drawIcon(pdf, 'gift', GIFT_COLOR, gx, gy, size)
    }
  })

  if (!opts.names) return

  // nombres (novios en rojo) y fila de etiquetas con icono + color de cada categoría
  layout.labels.forEach((l) => {
    const p = P(l.seat.x, l.seat.y)
    const total = measureSpec(pdf, l.spec)
    if (!l.rotated) {
      let y = p.y + l.rel.y0
      l.spec.lines.forEach((ln) => {
        const h = lineH(ln)
        if (ln.kind === 'text') {
          pdf.setFont('helvetica', ln.bold ? 'bold' : 'normal')
          pdf.setFontSize(ln.sizePt)
          if (ln.couple) pdf.setTextColor(...COUPLE_RGB)
          else pdf.setTextColor(INK)
          const x = l.align === 'left' ? p.x + l.rel.x0 : l.align === 'right' ? p.x + l.rel.x1 : p.x
          pdf.text(ln.text, x, y + h * 0.78, { align: l.align })
        } else {
          const m = measureTags(pdf, ln)
          let x = l.align === 'left' ? p.x + l.rel.x0 : l.align === 'right' ? p.x + l.rel.x1 - m.total : p.x - m.total / 2
          drawTagRun(pdf, ln, m, x, y, h, false)
        }
        y += h
      })
    } else {
      // Texto girado 90°: la línea base sube y los glifos quedan a su izquierda.
      // Encima de la mesa empieza junto al asiento y sube; debajo termina junto al asiento.
      let x = p.x + l.rel.x0
      l.spec.lines.forEach((ln) => {
        const h = lineH(ln)
        if (ln.kind === 'text') {
          pdf.setFont('helvetica', ln.bold ? 'bold' : 'normal')
          pdf.setFontSize(ln.sizePt)
          if (ln.couple) pdf.setTextColor(...COUPLE_RGB)
          else pdf.setTextColor(INK)
          const w = pdf.getTextWidth(ln.text)
          const anchorY = l.vdir < 0 ? p.y + l.rel.y1 : p.y + l.rel.y0 + w
          pdf.text(ln.text, x + h * 0.78, anchorY, { angle: 90 })
        } else {
          const m = measureTags(pdf, ln)
          const bottom = l.vdir < 0 ? p.y + l.rel.y1 : p.y + l.rel.y0 + m.total
          drawTagRun(pdf, ln, m, x, bottom, h, true)
        }
        x += h
      })
    }
    void total
  })
}

/**
 * Dibuja la fila de etiquetas: "(!)" si es alergia grave y, por cada categoría, una píldora
 * del color de la categoría con su miniatura y la abreviatura.
 * Horizontal: (x, y) es la esquina superior izquierda. Girada: x es el borde izquierdo y y el extremo inferior.
 */
function drawTagRun(
  pdf: jsPDF,
  line: Extract<LabelLine, { kind: 'tags' }>,
  m: { widths: number[]; severeW: number; total: number },
  x: number,
  y: number,
  h: number,
  rotated: boolean
) {
  const icon = h - 0.6
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(line.sizePt)
  let cursor = rotated ? y : x
  if (line.severe) {
    pdf.setTextColor(0)
    if (rotated) pdf.text(SEVERE_MARK, x + h * 0.72, cursor, { angle: 90 })
    else pdf.text(SEVERE_MARK, cursor, y + h * 0.72)
    cursor += rotated ? -m.severeW : m.severeW
  }
  line.items.forEach((it, i) => {
    const w = m.widths[i]
    pdf.setFillColor(...tint(it.color, 0.32))
    pdf.setDrawColor(...hexToRgb(it.color))
    pdf.setLineWidth(0.25)
    if (rotated) {
      const top = cursor - w
      pdf.roundedRect(x + 0.1, top, h - 0.2, w, 0.8, 0.8, 'FD')
      drawIcon(pdf, it.code, it.color, x + 0.3, cursor - CHIP_PAD - icon, icon)
      if (it.text) {
        pdf.setTextColor(INK)
        pdf.text(it.text, x + h * 0.74, cursor - CHIP_PAD - icon - 0.4, { angle: 90 })
      }
      cursor -= w + CHIP_GAP
    } else {
      pdf.roundedRect(cursor, y + 0.1, w, h - 0.2, 0.8, 0.8, 'FD')
      drawIcon(pdf, it.code, it.color, cursor + CHIP_PAD, y + 0.3, icon)
      if (it.text) {
        pdf.setTextColor(INK)
        pdf.text(it.text, cursor + CHIP_PAD + icon + 0.4, y + h * 0.72)
      }
      cursor += w + CHIP_GAP
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

interface LegendItem { code: string; color: string; text: string }

/** Categorías usadas por los invitados dados (más regalo), para la leyenda. */
function legendItems(guests: Guest[], showDietary: boolean): LegendItem[] {
  const items: LegendItem[] = []
  if (showDietary) {
    ALLERGENS.forEach((a) => {
      if (guests.some((g) => g.dietary.allergens.includes(a.code))) items.push({ code: a.code, color: a.color, text: pdfText(`${a.abbr} ${a.label}`) })
    })
    DIETS.forEach((d) => {
      if (guests.some((g) => g.dietary.diets.includes(d.code))) {
        items.push({ code: d.code, color: d.color, text: pdfText(d.code === 'bebe' ? `${d.abbr} Bebé (trona, sin menú)` : `${d.abbr} ${d.label}`) })
      }
    })
    if (guests.some((g) => hasDietary(g.dietary) && g.dietary.allergens.length === 0 && g.dietary.diets.length === 0)) {
      items.push({ code: 'nota', color: '#888888', text: 'VER NOTA en la hoja de catering' })
    }
  }
  if (guests.some((g) => g.gift)) items.push({ code: 'gift', color: GIFT_COLOR, text: 'Regalo en la mesa' })
  return items
}

const LEGEND_ROW = 5
const LEGEND_FS = 7

/** Reparte los elementos de la leyenda en filas que caben en el ancho disponible. */
function legendRows(pdf: jsPDF, items: LegendItem[], width: number, severeNote: boolean): { rows: (LegendItem | 'severe')[][] } {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(LEGEND_FS)
  const all: (LegendItem | 'severe')[] = [...(severeNote ? (['severe'] as const) : []), ...items]
  const rows: (LegendItem | 'severe')[][] = [[]]
  let used = 0
  all.forEach((it) => {
    const w = legendItemWidth(pdf, it)
    if (used + w > width && rows[rows.length - 1].length) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1].push(it)
    used += w
  })
  return { rows }
}

function legendItemWidth(pdf: jsPDF, it: LegendItem | 'severe'): number {
  if (it === 'severe') return pdf.getTextWidth(`${SEVERE_MARK} = alergia grave (evitar trazas)`) + 6
  return 3.6 + 1 + pdf.getTextWidth(it.text) + 5
}

function legendHeight(pdf: jsPDF, guests: Guest[], show: boolean, showDietary = true): number {
  if (!show) return 0
  const items = legendItems(guests, showDietary)
  const severe = showDietary && guests.some((g) => isSevere(g.dietary))
  if (!items.length && !severe) return 0
  const { w } = pageSize(pdf)
  return legendRows(pdf, items, w - MARGIN * 2 - 4, severe).rows.length * LEGEND_ROW + 3
}

function drawLegend(pdf: jsPDF, guests: Guest[], showDietary = true) {
  const { w, h } = pageSize(pdf)
  const height = legendHeight(pdf, guests, true, showDietary)
  if (!height) return
  const items = legendItems(guests, showDietary)
  const severe = showDietary && guests.some((g) => isSevere(g.dietary))
  const y0 = h - MARGIN - FOOTER_H - height + 1
  pdf.setDrawColor(190)
  pdf.setFillColor(248, 246, 241)
  pdf.setLineWidth(0.25)
  pdf.rect(MARGIN, y0, w - MARGIN * 2, height - 1.5, 'FD')
  const { rows } = legendRows(pdf, items, w - MARGIN * 2 - 4, severe)
  rows.forEach((row, r) => {
    let x = MARGIN + 2
    const y = y0 + 1.2 + r * LEGEND_ROW
    row.forEach((it) => {
      pdf.setFontSize(LEGEND_FS)
      if (it === 'severe') {
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(0)
        pdf.text(`${SEVERE_MARK} = alergia grave (evitar trazas)`, x, y + 2.9)
      } else {
        pdf.setFillColor(...tint(it.color, 0.32))
        pdf.setDrawColor(...hexToRgb(it.color))
        pdf.roundedRect(x - 0.3, y + 0.1, 3.6 + 1.3 + pdf.getTextWidth(it.text) + 0.6, 3.8, 0.8, 0.8, 'FD')
        drawIcon(pdf, it.code, it.color, x, y + 0.3, 3.4)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(INK)
        pdf.text(it.text, x + 3.6 + 1, y + 2.9)
      }
      x += legendItemWidth(pdf, it)
    })
  })
}

function chooseOrientation(option: PrintOrientation, wMeters: number, hMeters: number): 'portrait' | 'landscape' {
  if (option !== 'auto') return option
  return wMeters > hMeters * 1.05 ? 'landscape' : 'portrait'
}

// ---------------------------------------------------------------- generador principal

export function buildSeatingPdf(input: PrintInput, options: PrintOptions): { pdf: jsPDF; report: PrintReport } {
  const { scenario, guests } = input
  ICONS = input.icons ?? {}
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
  const legendReserve = legendHeight(pdf, seatedGuests, options.includeLegend, options.showDietary)
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
  }
  if (options.includeLegend) drawLegend(pdf, seatedGuests, options.showDietary)

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
        const f = contentFrame(probe, options.includeLegend ? legendHeight(probe, occupants, true, options.showDietary) : 0)
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
        const f = contentFrame(pdf, options.includeLegend ? legendHeight(pdf, legendGuests, true, options.showDietary) : 0)
        const layout = bestLayout(pdf, view, f, options.showDietary) ?? chosen!.layouts[i]
        drawView(pdf, view, layout, { names: true, seatNumbers: options.seatNumbers, showDietary: options.showDietary, tableLabels: true })
        if (options.includeLegend) drawLegend(pdf, legendGuests, options.showDietary)
      })
    })
  }

  // ---------- 3. hoja de catering
  if (options.cateringSheet) drawCateringSheet(pdf, ctx, scenario, guests, first)

  // ---------- 4. regalos
  if (options.giftSheet && guests.some((g) => g.gift && g.status !== 'rechazado')) drawGiftSheet(pdf, ctx, scenario, guests, first)

  // ---------- 5. sin asignar
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
    if (options.footer) {
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(INK)
      pdf.text(pdfText(options.footer), MARGIN, h - MARGIN + 1)
    }
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
    let babies = 0
    list.forEach((g) => {
      if (isBaby(g.dietary)) babies++
      const tags = dietaryTags(g.dietary).filter((t) => t.code !== 'bebe').map((t) => t.abbr)
      if (!tags.length && !isBaby(g.dietary)) tags.push('VER NOTA')
      tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1))
    })
    const severe = list.filter((g) => isSevere(g.dietary)).length
    const detail = [...counts.entries()].map(([k, v]) => `${v} ${k}`).join(', ')
    const parts = [detail && `menús: ${detail}`, babies && `${babies} bebé(s) en trona, sin menú`, severe && `${severe} ${SEVERE_MARK} alergia grave`].filter(Boolean)
    return `${tid ? tableName.get(tid) : 'Sin mesa'}: ${list.length} · ${parts.join(' · ')}`
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
    const tagDefs = dietaryTags(g.dietary)
    const tags = tagDefs.map((t) => t.abbr)
    const labels = tagDefs.map((t) => t.label)
    const baby = isBaby(g.dietary)
    const cells = [
      g.tableId && tableName.get(g.tableId) ? tableName.get(g.tableId)! : 'Sin mesa',
      g.seatIndex !== null && g.tableId ? String(g.seatIndex + 1) : '—',
      g.fullName,
      // primera línea vacía: ahí se dibujan las miniaturas de color
      labels.length ? `\n${tags.join('·')}\n${labels.join(', ')}` : '—',
      baby && !g.dietary.severity ? 'Trona' : severe ? `${SEVERE_MARK} ${sev}` : sev,
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
      if (i === 2 && g.isCouple) pdf.setTextColor(...COUPLE_RGB)
      else pdf.setTextColor(INK)
      pdf.text(lines, x + 1.5, y + 1.2 + LH * 0.8)
      if (i === 3) tagDefs.forEach((t, k) => drawIcon(pdf, t.code, t.color, x + 1.5 + k * (LH + 0.6), y + 1.2, LH))
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

// ---------------------------------------------------------------- regalos

/** Hoja para la wedding planner: dónde va cada regalo o detalle, por mesa y asiento. */
function drawGiftSheet(pdf: jsPDF, ctx: PageCtx, scenario: Scenario, guests: Guest[], first: { value: boolean }) {
  newPage(pdf, first, 'portrait')
  drawHeader(ctx, 'Regalos en la mesa')
  const frame = contentFrame(pdf)
  let y = frame.y0
  const tableOrder = new Map(scenario.tables.map((t, i) => [t.id, i]))
  const tableName = new Map(scenario.tables.map((t) => [t.id, t.name]))
  const list = guests
    .filter((g) => g.gift && g.status !== 'rechazado')
    .sort((a, b) => {
      const ta = a.tableId && tableOrder.has(a.tableId) ? tableOrder.get(a.tableId)! : 9999
      const tb = b.tableId && tableOrder.has(b.tableId) ? tableOrder.get(b.tableId)! : 9999
      return ta !== tb ? ta - tb : (a.seatIndex ?? 999) - (b.seatIndex ?? 999)
    })

  pdf.setTextColor(INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  drawIcon(pdf, 'gift', GIFT_COLOR, frame.x0, y + 0.6, 4.4)
  pdf.text(`${list.length} regalo(s) o detalle(s) que dejar en la mesa`, frame.x0 + 6, y + 4)
  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  const perTable = [...scenario.tables.map((t) => t.id), null]
    .map((tid) => {
      const n = list.filter((g) => (tid ? g.tableId === tid : !g.tableId || !tableOrder.has(g.tableId))).length
      return n ? `${tid ? tableName.get(tid) : 'Sin mesa'}: ${n}` : null
    })
    .filter(Boolean)
    .join('   ·   ')
  pdf.text(pdfText(perTable), frame.x0, y + 3)
  y += 7

  const cols: Col[] = [
    { title: 'Mesa', width: 24 },
    { title: 'Asiento', width: 16 },
    { title: 'Invitado', width: 60 },
    { title: 'Regalo', width: frame.x1 - frame.x0 - 100 }
  ]
  const FS = 9
  const LH = lineHeight(FS)
  const drawHead = () => {
    pdf.setFillColor(60, 60, 60)
    pdf.rect(frame.x0, y, frame.x1 - frame.x0, 6.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(255, 255, 255)
    let x = frame.x0
    cols.forEach((c) => {
      pdf.text(c.title, x + 1.5, y + 4.4)
      x += c.width
    })
    y += 6.5
  }
  drawHead()
  let prevTable: string | null | undefined
  list.forEach((g, idx) => {
    const cells = [
      g.tableId && tableName.get(g.tableId) ? tableName.get(g.tableId)! : 'Sin mesa',
      g.seatIndex !== null && g.tableId ? String(g.seatIndex + 1) : '—',
      g.fullName,
      g.gift!.description || '(sin especificar)'
    ]
    pdf.setFontSize(FS)
    const wrapped = cells.map((c, i) => {
      pdf.setFont('helvetica', i === 2 ? 'bold' : 'normal')
      return pdf.splitTextToSize(pdfText(c), cols[i].width - 3) as string[]
    })
    const rowH = Math.max(...wrapped.map((w) => w.length)) * LH + 3
    if (y + rowH > frame.y1) {
      pdf.addPage('a4', 'portrait')
      drawHeader(ctx, 'Regalos en la mesa (continuación)')
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
    let x = frame.x0
    wrapped.forEach((lines, i) => {
      pdf.setFont('helvetica', i === 2 ? 'bold' : 'normal')
      if (i === 2 && g.isCouple) pdf.setTextColor(...COUPLE_RGB)
      else pdf.setTextColor(INK)
      pdf.text(lines, x + 1.5, y + 1.5 + LH * 0.8)
      x += cols[i].width
    })
    pdf.setDrawColor(215)
    pdf.setLineWidth(0.2)
    pdf.line(frame.x0, y + rowH, frame.x1, y + rowH)
    y += rowH
  })
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
