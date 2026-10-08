import { formatDietary, hasDietary, dietaryAbbrs } from '@/utils/dietary'
import type { Guest, Scenario, TableItem } from '@/types'
import { languageAbbr } from '@/utils/language'
import { sectionDisplay, sectionForSeat } from '@/utils/sections'
import { fetchGuestsFromUrl } from './guestService'

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Exporta el listado de invitados (con su mesa/asiento asignados) a CSV. */
export function exportGuestsCsv(guests: Guest[], tables: TableItem[], filename = 'invitados.csv') {
  const tableName = new Map(tables.map((t) => [t.id, t.name]))
  const tableById = new Map(tables.map((t) => [t.id, t]))
  const header = [
    'Nombre', 'Apellidos', 'Nombre completo', 'Grupo', 'Rol', 'Acompañantes',
    'Estado', 'Notas', 'Restricciones alimentarias', 'Regalo en mesa', 'Idioma', 'Mesa', 'Submesa', 'Asiento'
  ]
  const rows = guests.map((g) => [
    g.firstName,
    g.lastName,
    g.fullName,
    g.group,
    g.role,
    String(g.companions),
    g.status,
    g.notes,
    formatDietary(g.dietary),
    g.gift ? g.gift.description || 'Sí' : '',
    languageAbbr(g.language),
    g.tableId ? tableName.get(g.tableId) ?? '' : '',
    (() => {
      const sec = g.tableId ? sectionForSeat(tableById.get(g.tableId), g.seatIndex) : null
      return sec ? sectionDisplay(sec.label) : ''
    })(),
    g.seatIndex !== null ? String(g.seatIndex + 1) : ''
  ])
  const csv = [header, ...rows].map((r) => r.map((c) => csvEscape(String(c))).join(',')).join('\n')
  triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

/** Exporta el escenario completo (mesas + invitados asignados) a JSON legible. */
export function exportScenarioJson(scenario: Scenario, guests: Guest[], filename = 'seating-plan.json') {
  const assigned = guests.filter((g) => g.tableId)
  const payload = {
    escenario: scenario.name,
    sala: scenario.room,
    elementos: scenario.roomFeatures,
    mesas: scenario.tables.map((t) => ({
      ...t,
      invitados: assigned.filter((g) => g.tableId === t.id).map((g) => ({
        nombre: g.fullName,
        ...(sectionForSeat(t, g.seatIndex) ? { submesa: sectionForSeat(t, g.seatIndex)!.label } : {}),
        ...(g.language ? { idioma: languageAbbr(g.language) } : {}),
        rol: g.role,
        novios: g.isCouple,
        asiento: g.seatIndex !== null ? g.seatIndex + 1 : null,
        ...(hasDietary(g.dietary)
          ? { alergias: dietaryAbbrs(g.dietary), restricciones: formatDietary(g.dietary), gravedad: g.dietary.severity }
          : {}),
        ...(g.gift ? { regalo: g.gift.description || 'sí' } : {})
      }))
    }))
  }
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename)
}

/** Resoluciones de exportación disponibles, pensadas para entregar a proveedores/wedding planners. */
export const PNG_RESOLUTIONS = {
  estandar: { label: 'Estándar (pantalla)', widthPx: 1600 },
  alta: { label: 'Alta (impresión doméstica)', widthPx: 2600 },
  maxima: { label: 'Máxima (imprenta profesional)', widthPx: 4000 }
} as const

export type PngResolutionKey = keyof typeof PNG_RESOLUTIONS

function cloneSvgWithBackground(svgEl: SVGSVGElement): { clone: SVGSVGElement; widthUnits: number; heightUnits: number } {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  const bbox = svgEl.viewBox.baseVal
  const widthUnits = bbox && bbox.width ? bbox.width : svgEl.clientWidth
  const heightUnits = bbox && bbox.height ? bbox.height : svgEl.clientHeight

  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim() || '#EDE4D0'
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('x', String(bbox.x))
  bgRect.setAttribute('y', String(bbox.y))
  bgRect.setAttribute('width', String(widthUnits))
  bgRect.setAttribute('height', String(heightUnits))
  bgRect.setAttribute('fill', bgColor)
  clone.insertBefore(bgRect, clone.firstChild)

  return { clone, widthUnits, heightUnits }
}

/**
 * Serializa el plano (SVG) a una imagen PNG de alta resolución, pensada para
 * entregar a proveedores (p.ej. la wedding planner) con calidad de impresión.
 * La resolución final es independiente de las dimensiones en metros de la sala:
 * se calcula a partir del ancho de salida deseado en píxeles.
 */
export async function exportSvgToPng(
  svgEl: SVGSVGElement,
  filename = 'seating-plan.png',
  resolution: PngResolutionKey = 'alta'
) {
  const { clone, widthUnits, heightUnits } = cloneSvgWithBackground(svgEl)
  const targetWidthPx = PNG_RESOLUTIONS[resolution].widthPx
  const scale = targetWidthPx / widthUnits
  const outWidth = Math.round(widthUnits * scale)
  const outHeight = Math.round(heightUnits * scale)

  clone.setAttribute('width', String(widthUnits))
  clone.setAttribute('height', String(heightUnits))

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = outWidth
      canvas.height = outHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se ha podido crear el lienzo de exportación.'))
        return
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, outWidth, outHeight)
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, filename)
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se ha podido generar la imagen a partir del plano.'))
    }
    img.src = url
  })
}

/**
 * Exporta el plano a PDF vectorial real (no una imagen incrustada), usando
 * jsPDF + svg2pdf.js. El texto y las líneas se mantienen nítidos a cualquier
 * zoom de impresión, ideal para entregar a proveedores.
 */
export async function exportSvgToPdf(svgEl: SVGSVGElement, filename = 'seating-plan.pdf') {
  const { jsPDF } = await import('jspdf')
  const { svg2pdf } = await import('svg2pdf.js')

  const { clone, widthUnits, heightUnits } = cloneSvgWithBackground(svgEl)
  clone.removeAttribute('width')
  clone.removeAttribute('height')

  // 1 metro de sala = 60pt en el PDF (proporción legible en A3/A4 apaisado según tamaño de sala).
  const PT_PER_METER = 60
  const pageWidth = widthUnits * PT_PER_METER
  const pageHeight = heightUnits * PT_PER_METER

  const pdf = new jsPDF({
    orientation: pageWidth >= pageHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageWidth, pageHeight]
  })

  await svg2pdf(clone, pdf, { x: 0, y: 0, width: pageWidth, height: pageHeight })
  pdf.save(filename)
}

/** Abre el diálogo de impresión del navegador; el CSS de impresión se encarga del layout. */
export function printSeatingPlan() {
  window.print()
}

// ---------------------------------------------------------------- idioma → Google Sheet

export interface LanguageColumnRow {
  /** Fila de la hoja (1 = cabecera). */
  row: number
  name: string
  value: string
  status: 'ok' | 'sin-idioma' | 'no-encontrado'
}

export interface LanguageColumnResult {
  header: string
  rows: LanguageColumnRow[]
  /** Texto listo para pegar a partir de la celda H1 (una línea por fila de la hoja). */
  text: string
  /** True si se ha leído la hoja en este momento; false si se ha usado el orden guardado en la última sincronización. */
  live: boolean
  /** Invitados de la app que no están en la hoja (añadidos a mano o renombrados). */
  notInSheet: string[]
}

function nameKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Prepara la columna de idioma (CAT/ESP) alineada fila a fila con la Google Sheet.
 * Lee la hoja en este momento para respetar su orden actual y empareja cada fila con
 * el invitado de la app por nombre completo (igual que la sincronización).
 * Si no se puede leer la hoja, usa la fila guardada en la última sincronización.
 */
export async function buildLanguageColumn(sheetUrl: string, guests: Guest[], header = 'Idioma'): Promise<LanguageColumnResult> {
  let sheetRows: { row: number; name: string }[]
  let live = true
  try {
    const { guests: fromSheet } = await fetchGuestsFromUrl(sheetUrl)
    sheetRows = fromSheet.map((g) => ({ row: g.sourceRow ?? 0, name: g.fullName })).filter((r) => r.row > 1)
  } catch {
    live = false
    sheetRows = guests.filter((g) => g.sourceRow).map((g) => ({ row: g.sourceRow!, name: g.fullName }))
  }

  const byName = new Map<string, Guest[]>()
  guests.forEach((g) => {
    const k = nameKey(g.fullName)
    byName.set(k, [...(byName.get(k) ?? []), g])
  })
  const used = new Set<string>()
  const rows: LanguageColumnRow[] = sheetRows
    .sort((a, b) => a.row - b.row)
    .map((r) => {
      const candidates = (byName.get(nameKey(r.name)) ?? []).filter((g) => !used.has(g.id))
      const g = candidates[0]
      if (!g) return { row: r.row, name: r.name, value: '', status: 'no-encontrado' as const }
      used.add(g.id)
      const value = languageAbbr(g.language)
      return { row: r.row, name: r.name, value, status: value ? ('ok' as const) : ('sin-idioma' as const) }
    })

  const maxRow = rows.reduce((m, r) => Math.max(m, r.row), 1)
  const byRow = new Map(rows.map((r) => [r.row, r.value]))
  const lines = [header]
  for (let row = 2; row <= maxRow; row++) lines.push(byRow.get(row) ?? '')

  return {
    header,
    rows,
    text: lines.join('\n'),
    live,
    notInSheet: guests.filter((g) => !used.has(g.id)).map((g) => g.fullName)
  }
}

/** CSV de control con fila, nombre e idioma (para importarlo o revisarlo). */
export function exportLanguageCsv(result: LanguageColumnResult, filename = 'idiomas-columna-H.csv') {
  const lines = [['Fila', 'Nombre', result.header], ...result.rows.map((r) => [String(r.row), r.name, r.value])]
  const csv = lines.map((l) => l.map((c) => csvEscape(c)).join(',')).join('\n')
  triggerDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }), filename)
}
