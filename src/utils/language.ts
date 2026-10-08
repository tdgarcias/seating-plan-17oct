import type { GuestLanguage } from '@/types'

/** Idioma del detalle de cada invitado. Las abreviaturas son las que se imprimen y se exportan a la hoja. */
export const LANGUAGES: { code: GuestLanguage; abbr: 'CAT' | 'ESP'; label: string }[] = [
  { code: 'ca', abbr: 'CAT', label: 'Català' },
  { code: 'es', abbr: 'ESP', label: 'Español' }
]

export function languageAbbr(lang: GuestLanguage | null | undefined): string {
  return LANGUAGES.find((l) => l.code === lang)?.abbr ?? ''
}

/** Interpreta lo que venga en una celda: "CAT", "català", "ca", "ESP", "castellano", "es"... */
export function parseLanguage(raw: string | undefined | null): GuestLanguage | null {
  const v = (raw ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  if (!v) return null
  if (['cat', 'ca', 'catala', 'catalan', 'catalunya', 'mallorqui'].includes(v) || v.startsWith('catal')) return 'ca'
  if (['esp', 'es', 'cas', 'castellano', 'espanol', 'spanish', 'esp.'].includes(v) || v.startsWith('castell') || v.startsWith('espa')) return 'es'
  return null
}

export function normalizeLanguage(value: unknown): GuestLanguage | null {
  return value === 'ca' || value === 'es' ? value : typeof value === 'string' ? parseLanguage(value) : null
}
