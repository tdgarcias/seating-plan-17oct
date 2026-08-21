import type { Guest, Scenario, TableItem } from '@/types'

function triggerDownload(blob: Blob, filename: string) {
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
  const header = [
    'Nombre', 'Apellidos', 'Nombre completo', 'Grupo', 'Rol', 'Acompañantes',
    'Estado', 'Notas', 'Restricciones alimentarias', 'Mesa', 'Asiento'
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
    g.dietary,
    g.tableId ? tableName.get(g.tableId) ?? '' : '',
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
        nombre: g.fullName, rol: g.role, novios: g.isCouple, asiento: g.seatIndex !== null ? g.seatIndex + 1 : null
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
