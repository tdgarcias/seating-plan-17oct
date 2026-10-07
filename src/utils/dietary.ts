import type { AllergenCode, DietCode, DietaryInfo, DietarySeverity } from '@/types'

export interface AllergenDef {
  code: AllergenCode
  label: string
  /** Abreviatura de 3 letras pensada para impresión en blanco y negro. */
  abbr: string
  icon: string
  /** Color fijo de la categoría: todos los invitados con este alérgeno se marcan igual. */
  color: string
  /** Palabras que, en el texto de la hoja, indican este alérgeno (sin tildes, minúsculas). */
  keywords: string[]
}

export interface DietDef {
  code: DietCode
  label: string
  abbr: string
  icon: string
  color: string
  keywords: string[]
}

export const ALLERGENS: AllergenDef[] = [
  { code: 'gluten', label: 'Gluten', abbr: 'GLU', icon: '🌾', color: '#C8902E', keywords: ['gluten', 'celiac', 'trigo'] },
  { code: 'crustaceos', label: 'Crustáceos', abbr: 'CRU', icon: '🦐', color: '#E4572E', keywords: ['crustaceo', 'marisco', 'gamba', 'langostino'] },
  { code: 'huevo', label: 'Huevo', abbr: 'HUE', icon: '🥚', color: '#F3D34A', keywords: ['huevo'] },
  { code: 'pescado', label: 'Pescado', abbr: 'PES', icon: '🐟', color: '#3A86C8', keywords: ['pescado'] },
  { code: 'cacahuete', label: 'Cacahuete', abbr: 'CAC', icon: '🥜', color: '#8C5A3C', keywords: ['cacahuete', 'mani'] },
  { code: 'soja', label: 'Soja', abbr: 'SOJ', icon: '🫘', color: '#6A994E', keywords: ['soja'] },
  { code: 'lacteos', label: 'Lácteos', abbr: 'LAC', icon: '🥛', color: '#8ECAE6', keywords: ['lactosa', 'lacteo', 'leche', 'caseina'] },
  { code: 'frutos_cascara', label: 'Frutos de cáscara', abbr: 'FCA', icon: '🌰', color: '#5C3D2E', keywords: ['frutos secos', 'fruto seco', 'frutos de cascara', 'nuez', 'nueces', 'almendra', 'avellana', 'pistacho'] },
  { code: 'apio', label: 'Apio', abbr: 'API', icon: '🥬', color: '#90BE6D', keywords: ['apio'] },
  { code: 'mostaza', label: 'Mostaza', abbr: 'MOS', icon: '🟡', color: '#B5A642', keywords: ['mostaza'] },
  { code: 'sesamo', label: 'Sésamo', abbr: 'SES', icon: '⚪', color: '#D9CAB3', keywords: ['sesamo'] },
  { code: 'sulfitos', label: 'Sulfitos', abbr: 'SUL', icon: '🍷', color: '#7B2D56', keywords: ['sulfito'] },
  { code: 'altramuces', label: 'Altramuces', abbr: 'ALT', icon: '🫛', color: '#F4A261', keywords: ['altramuz', 'altramuces'] },
  { code: 'moluscos', label: 'Moluscos', abbr: 'MOL', icon: '🦑', color: '#9B5DE5', keywords: ['molusco', 'mejillon', 'almeja', 'calamar', 'pulpo'] }
]

export const DIETS: DietDef[] = [
  { code: 'vegetariano', label: 'Vegetariano', abbr: 'VEGT', icon: '🥗', color: '#2A9D8F', keywords: ['vegetarian'] },
  { code: 'vegano', label: 'Vegano', abbr: 'VEGN', icon: '🌱', color: '#1B7F3B', keywords: ['vegano', 'vegana', 'vegan'] },
  { code: 'pescetariano', label: 'Pescetariano', abbr: 'PESC', icon: '🍤', color: '#219EBC', keywords: ['pescetarian', 'pescatarian', 'piscitarian', 'piscetarian'] },
  { code: 'sin_cerdo', label: 'Sin cerdo', abbr: 'S/CER', icon: '🚫', color: '#E07A9A', keywords: ['sin cerdo', 'no cerdo', 'no come cerdo'] },
  { code: 'halal', label: 'Halal', abbr: 'HAL', icon: '☪', color: '#4C6A92', keywords: ['halal'] },
  { code: 'kosher', label: 'Kosher', abbr: 'KOS', icon: '✡', color: '#6C757D', keywords: ['kosher'] },
  { code: 'embarazada', label: 'Embarazada', abbr: 'EMB', icon: '🤰', color: '#F15BB5', keywords: ['embarazada'] },
  { code: 'infantil', label: 'Menú infantil', abbr: 'INF', icon: '🧒', color: '#FF9F1C', keywords: ['infantil', 'menu nino', 'menu de nino'] },
  { code: 'bebe', label: 'Bebé (trona, sin menú)', abbr: 'BEBÉ', icon: '👶', color: '#A0C4FF', keywords: [] }
]

/** Icono y color del regalo en la mesa. */
export const GIFT_ICON = '🎁'
export const GIFT_COLOR = '#C1121F'

/** Un bebé ocupa plaza pero se sienta en trona y no lleva menú. */
export function isBaby(d: DietaryInfo | null | undefined): boolean {
  return !!d && d.diets.includes('bebe')
}

/** Colores de las categorías del invitado, en orden estable (para el asiento dividido). */
export function dietaryColors(d: DietaryInfo | null | undefined): string[] {
  if (!d) return []
  return [
    ...ALLERGENS.filter((a) => d.allergens.includes(a.code)).map((a) => a.color),
    ...DIETS.filter((x) => d.diets.includes(x.code)).map((x) => x.color)
  ]
}

/** Categorías del invitado con su icono, color y abreviatura (para la impresión). */
export function dietaryTags(d: DietaryInfo | null | undefined): { code: string; abbr: string; label: string; icon: string; color: string }[] {
  if (!d) return []
  return [
    ...ALLERGENS.filter((a) => d.allergens.includes(a.code)),
    ...DIETS.filter((x) => d.diets.includes(x.code))
  ].map((x) => ({ code: x.code, abbr: x.abbr, label: x.label, icon: x.icon, color: x.color }))
}

export const SEVERITIES: { code: DietarySeverity; label: string; hint: string }[] = [
  { code: 'alergia', label: 'Alergia', hint: 'Riesgo grave: evitar incluso trazas' },
  { code: 'intolerancia', label: 'Intolerancia', hint: 'Evitar el ingrediente' },
  { code: 'preferencia', label: 'Preferencia', hint: 'Elección personal' }
]

const allergenByCode = new Map(ALLERGENS.map((a) => [a.code, a]))
const dietByCode = new Map(DIETS.map((d) => [d.code, d]))

export function allergenDef(code: AllergenCode) {
  return allergenByCode.get(code)
}
export function dietDef(code: DietCode) {
  return dietByCode.get(code)
}

export function emptyDietary(): DietaryInfo {
  return { allergens: [], diets: [], severity: null, notes: '' }
}

/** True si el invitado tiene alguna restricción o nota alimentaria. */
export function hasDietary(d: DietaryInfo | null | undefined): boolean {
  return !!d && (d.allergens.length > 0 || d.diets.length > 0 || d.notes.trim() !== '')
}

/** True si debe tratarse como alergia (riesgo grave). */
export function isSevere(d: DietaryInfo | null | undefined): boolean {
  return !!d && hasDietary(d) && d.severity === 'alergia'
}

/** Abreviaturas (GLU, LAC, VEGT...) en orden estable. */
export function dietaryAbbrs(d: DietaryInfo | null | undefined): string[] {
  if (!d) return []
  return [
    ...ALLERGENS.filter((a) => d.allergens.includes(a.code)).map((a) => a.abbr),
    ...DIETS.filter((x) => d.diets.includes(x.code)).map((x) => x.abbr)
  ]
}

/** Etiquetas legibles ("Gluten, Lácteos, Vegetariano"). */
export function dietaryLabels(d: DietaryInfo | null | undefined): string[] {
  if (!d) return []
  return [
    ...ALLERGENS.filter((a) => d.allergens.includes(a.code)).map((a) => a.label),
    ...DIETS.filter((x) => d.diets.includes(x.code)).map((x) => x.label)
  ]
}

/** Texto completo para CSV, tooltips o IA: "Alergia: Gluten, Lácteos · celíaca estricta". */
export function formatDietary(d: DietaryInfo | null | undefined): string {
  if (!hasDietary(d)) return ''
  const info = d as DietaryInfo
  const labels = dietaryLabels(info).join(', ')
  const sev = info.severity ? SEVERITIES.find((s) => s.code === info.severity)?.label : ''
  const head = [sev, labels].filter(Boolean).join(': ')
  return [head, info.notes.trim()].filter(Boolean).join(' · ')
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Detecta alérgenos, dietas y gravedad a partir de un texto libre (columna de la hoja). */
export function parseDietaryText(text: string): DietaryInfo {
  const raw = (text ?? '').trim()
  const info = emptyDietary()
  if (!raw) return info
  const t = normalizeText(raw)
  if (['no', 'ninguna', 'ninguno', 'nada', '-', 'n/a', 'na'].includes(t)) return info
  ALLERGENS.forEach((a) => {
    if (a.keywords.some((k) => t.includes(k))) info.allergens.push(a.code)
  })
  DIETS.forEach((d) => {
    if (d.keywords.some((k) => t.includes(k))) info.diets.push(d.code)
  })
  // "bebe" sin tilde es también un verbo ("no bebe alcohol"): solo se detecta con tilde, "trona" o "baby"
  if (/bebé|trona|\bbaby\b/i.test(raw)) info.diets.push('bebe')
  if (info.diets.includes('vegano')) info.diets = info.diets.filter((d) => d !== 'vegetariano')
  if (/alergi|anafila/.test(t)) info.severity = 'alergia'
  else if (/intoleran|celiac/.test(t)) info.severity = 'intolerancia'
  else if (info.allergens.length > 0) info.severity = 'intolerancia'
  else if (info.diets.some((d) => d !== 'bebe')) info.severity = 'preferencia'
  info.notes = raw
  return info
}

/** Convierte cualquier valor guardado (string antiguo, objeto parcial, null) en un DietaryInfo válido. */
export function normalizeDietary(value: unknown): DietaryInfo {
  if (typeof value === 'string') {
    return value.trim() ? { ...emptyDietary(), notes: value.trim() } : emptyDietary()
  }
  if (value && typeof value === 'object') {
    const v = value as Partial<DietaryInfo>
    const validA = new Set(ALLERGENS.map((a) => a.code))
    const validD = new Set(DIETS.map((d) => d.code))
    return {
      allergens: Array.isArray(v.allergens) ? v.allergens.filter((a) => validA.has(a)) : [],
      diets: Array.isArray(v.diets) ? v.diets.filter((d) => validD.has(d)) : [],
      severity: v.severity === 'alergia' || v.severity === 'intolerancia' || v.severity === 'preferencia' ? v.severity : null,
      notes: typeof v.notes === 'string' ? v.notes : '',
      ...(typeof v.sheetText === 'string' ? { sheetText: v.sheetText } : {})
    }
  }
  return emptyDietary()
}

/** True si el invitado tiene datos de alergias introducidos/editados en la app. */
export function hasManualDietary(d: DietaryInfo): boolean {
  if (!hasDietary(d)) return false
  // Si coincide exactamente con lo que se autodetectaría del texto de la hoja, no es edición manual.
  if (d.sheetText !== undefined) {
    const auto = parseDietaryText(d.sheetText)
    const same =
      auto.notes === d.notes &&
      auto.severity === d.severity &&
      auto.allergens.join() === d.allergens.join() &&
      auto.diets.join() === d.diets.join()
    if (same) return false
  }
  return true
}

/** Resumen de restricciones: total por alérgeno/dieta. */
export function summarizeDietary(guests: { dietary: DietaryInfo }[]): { label: string; abbr: string; count: number }[] {
  const out: { label: string; abbr: string; count: number }[] = []
  ALLERGENS.forEach((a) => {
    const count = guests.filter((g) => g.dietary.allergens.includes(a.code)).length
    if (count) out.push({ label: a.label, abbr: a.abbr, count })
  })
  DIETS.forEach((d) => {
    const count = guests.filter((g) => g.dietary.diets.includes(d.code)).length
    if (count) out.push({ label: d.label, abbr: d.abbr, count })
  })
  const notesOnly = guests.filter((g) => g.dietary.allergens.length === 0 && g.dietary.diets.length === 0 && g.dietary.notes.trim()).length
  if (notesOnly) out.push({ label: 'Otras (ver notas)', abbr: 'OTR', count: notesOnly })
  return out
}
