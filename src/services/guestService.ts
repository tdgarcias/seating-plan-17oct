import type { ConfirmationStatus, Guest, GuestColumnMapping } from '@/types'
import { createId } from '@/utils/id'

/**
 * guestService
 * ------------
 * Único punto de acceso a la fuente de invitados. Hoy lee de un Google Sheet
 * publicado como CSV (sin necesidad de Google Apps Script ni API keys).
 *
 * Si en el futuro se cambia la fuente de datos (otra hoja, un JSON, un CMS...),
 * SOLO este archivo debería modificarse. El resto de la aplicación consume
 * únicamente `fetchGuestsFromUrl` / `parseGuestsFromCsv` y el tipo `Guest`.
 *
 * CÓMO PUBLICAR LA GOOGLE SHEET (una sola vez, desde Google Sheets):
 *   Archivo → Compartir → Publicar en la Web → seleccionar la hoja → formato CSV → Publicar.
 *   Alternativamente basta con "Compartir" → "Cualquier persona con el enlace puede ver",
 *   ya que el endpoint gviz utilizado abajo funciona igualmente en ese caso.
 *   No se necesita ninguna API key: la URL resultante es pública y de solo lectura.
 */

export class GuestServiceError extends Error {}

/** Extrae el ID de una URL típica de Google Sheets. */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

/** Extrae el gid (identificador de pestaña/hoja) de una URL de Google Sheets, si está presente. */
export function extractGid(url: string): string {
  const match = url.match(/[#&?]gid=(\d+)/)
  return match ? match[1] : '0'
}

/** Construye la URL pública de exportación CSV a partir del ID de la hoja. */
export function buildCsvUrl(sheetId: string, gid = '0'): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
}

/** Parser CSV tolerante a comillas y comas dentro de campos entrecomillados (sin dependencias). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const SYNONYMS: Record<keyof GuestColumnMapping, string[]> = {
  firstName: ['nombre', 'first name', 'name'],
  lastName: ['apellido', 'apellidos', 'last name', 'surname'],
  fullName: ['nombre completo', 'full name', 'invitado', 'guest'],
  group: ['grupo', 'familia', 'group', 'grupo/familia'],
  companions: ['acompanantes', 'acompanante', 'companions', 'plus one', 'invitados adicionales'],
  status: ['confirmado', 'estado', 'confirmacion', 'status', 'rsvp'],
  notes: ['notas', 'notes', 'observaciones'],
  dietary: ['restricciones alimentarias', 'alergias', 'dieta', 'dietary', 'alimentacion'],
  table: ['mesa', 'table'],
  role: ['rol', 'role', 'relacion', 'tipo de invitado', 'relationship']
}

/** Palabras clave (en Notas o en la columna Rol) que marcan a un invitado como uno de los novios. */
const COUPLE_KEYWORDS = ['novio', 'novia', 'novios', 'groom', 'bride']

function detectIsCouple(notes: string, role: string): boolean {
  const haystack = `${notes} ${role}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return COUPLE_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`).test(haystack))
}

/** Detecta automáticamente qué columna de la cabecera corresponde a cada campo del invitado. */
export function autoDetectMapping(headers: string[]): GuestColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: GuestColumnMapping = {}

  ;(Object.keys(SYNONYMS) as (keyof GuestColumnMapping)[]).forEach((field) => {
    const candidates = SYNONYMS[field]
    const idx = normalized.findIndex((h) => candidates.some((c) => h === c || h.includes(c)))
    if (idx !== -1) mapping[field] = headers[idx]
  })

  return mapping
}

function parseStatus(raw: string | undefined): ConfirmationStatus {
  const v = (raw ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (['si', 'sí', 'confirmado', 'yes', 'confirmed', 'true', '1'].includes(v)) return 'confirmado'
  if (['no', 'rechazado', 'declined', 'false', '0'].includes(v)) return 'rechazado'
  return 'pendiente'
}

function parseCompanions(raw: string | undefined): number {
  const n = parseInt((raw ?? '0').replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Convierte filas CSV crudas en invitados normalizados.
 * Si `mapping` no se especifica, se auto-detecta a partir de la cabecera.
 */
export function normalizeGuests(rows: string[][], mapping?: GuestColumnMapping): Guest[] {
  if (rows.length === 0) return []
  const [headerRow, ...dataRows] = rows
  const finalMapping = mapping ?? autoDetectMapping(headerRow)
  const colIndex = (col?: string) => (col ? headerRow.indexOf(col) : -1)

  const iFirst = colIndex(finalMapping.firstName)
  const iLast = colIndex(finalMapping.lastName)
  const iFull = colIndex(finalMapping.fullName)
  const iGroup = colIndex(finalMapping.group)
  const iCompanions = colIndex(finalMapping.companions)
  const iStatus = colIndex(finalMapping.status)
  const iNotes = colIndex(finalMapping.notes)
  const iDietary = colIndex(finalMapping.dietary)
  const iRole = colIndex(finalMapping.role)

  return dataRows.map((row, rowIdx) => {
    const first = iFirst !== -1 ? row[iFirst]?.trim() ?? '' : ''
    const last = iLast !== -1 ? row[iLast]?.trim() ?? '' : ''
    let full = iFull !== -1 ? row[iFull]?.trim() ?? '' : ''
    if (!full) full = [first, last].filter(Boolean).join(' ')
    const idxCols = { iGroup, iCompanions, iStatus, iNotes, iDietary, iRole }
    if (!first && !last && full) {
      const parts = full.split(' ')
      return buildGuest(parts[0] ?? full, parts.slice(1).join(' '), full, row, idxCols, headerRow, rowIdx)
    }
    return buildGuest(first, last, full, row, idxCols, headerRow, rowIdx)
  }).filter((g) => g.fullName.trim() !== '')
}

function buildGuest(
  first: string,
  last: string,
  full: string,
  row: string[],
  idx: { iGroup: number; iCompanions: number; iStatus: number; iNotes: number; iDietary: number; iRole: number },
  headerRow: string[],
  rowIdx: number
): Guest {
  const notes = idx.iNotes !== -1 ? row[idx.iNotes]?.trim() ?? '' : ''
  const role = idx.iRole !== -1 ? row[idx.iRole]?.trim() ?? '' : ''
  return {
    id: createId('guest'),
    firstName: first,
    lastName: last,
    fullName: full,
    group: idx.iGroup !== -1 ? row[idx.iGroup]?.trim() ?? '' : '',
    companions: parseCompanions(idx.iCompanions !== -1 ? row[idx.iCompanions] : undefined),
    status: parseStatus(idx.iStatus !== -1 ? row[idx.iStatus] : undefined),
    notes,
    dietary: idx.iDietary !== -1 ? row[idx.iDietary]?.trim() ?? '' : '',
    role,
    isCouple: detectIsCouple(notes, role),
    sourceRow: rowIdx + 2, // +2: fila 1 = cabecera, base 1 = igual que en la hoja
    tableId: null,
    seatIndex: null
  }
}

export interface FetchResult {
  guests: Guest[]
  headers: string[]
  mapping: GuestColumnMapping
  fetchedAt: number
}

/** Descarga y normaliza los invitados desde una URL de Google Sheets (o cualquier CSV público). */
export async function fetchGuestsFromUrl(sheetUrlOrId: string): Promise<FetchResult> {
  const sheetId = extractSheetId(sheetUrlOrId) ?? sheetUrlOrId
  const gid = extractGid(sheetUrlOrId)
  const csvUrl = buildCsvUrl(sheetId, gid)

  let response: Response
  try {
    response = await fetch(csvUrl)
  } catch (err) {
    throw new GuestServiceError(
      'No se ha podido conectar con Google Sheets. Comprueba tu conexión a internet.'
    )
  }

  if (!response.ok) {
    throw new GuestServiceError(
      'No se ha podido conectar con Google Sheets. Verifica que la hoja esté compartida como "Cualquier persona con el enlace puede ver".'
    )
  }

  const text = await response.text()
  if (text.trim().startsWith('<')) {
    throw new GuestServiceError(
      'La hoja de Google Sheets no es accesible públicamente. Comparte la hoja como "Cualquier persona con el enlace" o publícala en la Web como CSV.'
    )
  }

  const rows = parseCsv(text)
  const headers = rows[0] ?? []
  const mapping = autoDetectMapping(headers)
  const guests = normalizeGuests(rows, mapping)

  if (headers.length === 0) {
    throw new GuestServiceError(
      'La hoja se ha leído pero está vacía. Comprueba que la pestaña seleccionada contiene datos.'
    )
  }

  if (guests.length === 0) {
    throw new GuestServiceError(
      `La hoja se ha leído correctamente (columnas detectadas: ${headers.join(', ')}) pero ninguna se reconoce como nombre de invitado. ` +
      'Renombra la columna del nombre a algo como "Nombre" o "Nombre completo", o revisa que la fila 1 contenga las cabeceras.'
    )
  }

  return { guests, headers, mapping, fetchedAt: Date.now() }
}

/**
 * Fusiona una nueva lista de invitados (recién importada) con la lista existente,
 * preservando las asignaciones de mesa/asiento ya hechas en la app cuando el
 * invitado coincide por nombre completo.
 */
export function mergePreservingAssignments(existing: Guest[], incoming: Guest[]): Guest[] {
  const byName = new Map(existing.map((g) => [g.fullName.toLowerCase().trim(), g]))
  return incoming.map((g) => {
    const prev = byName.get(g.fullName.toLowerCase().trim())
    if (!prev) return g
    // Si la hoja no aporta rol/marca de novios para este invitado, conserva lo editado manualmente en la app.
    const role = g.role || prev.role
    const isCouple = g.role || g.notes ? g.isCouple : prev.isCouple
    return { ...g, tableId: prev.tableId, seatIndex: prev.seatIndex, role, isCouple }
  })
}
