import type { Guest, RoomFeature, Scenario } from '@/types'

/**
 * aiAnalysisService
 * ------------------
 * Genera una valoración del seating plan usando la API de Anthropic (Claude),
 * llamada directamente desde el navegador con la clave de API que el propio
 * usuario introduce en la aplicación.
 *
 * IMPORTANTE SOBRE SEGURIDAD:
 * Esta aplicación no tiene backend, así que no hay ningún sitio "seguro" del
 * lado del servidor donde guardar una clave de API compartida. Por eso la
 * clave la aporta cada usuario y se guarda ÚNICAMENTE en su propio navegador
 * (localStorage), nunca en el código fuente ni en el proyecto exportado.
 * La API de Anthropic admite llamadas directas desde el navegador mediante
 * la cabecera `anthropic-dangerous-direct-browser-access`.
 *
 * Consigue una clave en https://console.anthropic.com/settings/keys
 */

export class AIAnalysisError extends Error {}

const AI_KEY_STORAGE = 'seating-plan-boda:ai-key:v1'
const AI_MODEL_STORAGE = 'seating-plan-boda:ai-model:v1'
export const DEFAULT_AI_MODEL = 'claude-sonnet-5'

export function loadStoredApiKey(): string {
  try {
    return localStorage.getItem(AI_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveStoredApiKey(key: string) {
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key)
    else localStorage.removeItem(AI_KEY_STORAGE)
  } catch {
    /* localStorage no disponible: se ignora, la clave solo durará la sesión */
  }
}

export function loadStoredModel(): string {
  try {
    return localStorage.getItem(AI_MODEL_STORAGE) || DEFAULT_AI_MODEL
  } catch {
    return DEFAULT_AI_MODEL
  }
}

export function saveStoredModel(model: string) {
  try {
    localStorage.setItem(AI_MODEL_STORAGE, model || DEFAULT_AI_MODEL)
  } catch {
    /* no-op */
  }
}

const FEATURE_LABELS: Record<RoomFeature['type'], string> = {
  dj: 'DJ / música',
  banos: 'Baños',
  puerta: 'Puerta / entrada',
  barra: 'Barra',
  pista: 'Pista de baile',
  otro: 'Otro elemento'
}

function buildPrompt(scenario: Scenario, guests: Guest[], coupleNames: string): string {
  const assigned = guests.filter((g) => g.tableId)
  const unassigned = guests.filter((g) => !g.tableId)

  const tablesDescription = scenario.tables.map((table) => {
    const occupants = assigned.filter((g) => g.tableId === table.id)
    const guestLines = occupants.map((g) => {
      const tags = [g.isCouple ? 'NOVIOS' : null, g.role || null, g.group || null].filter(Boolean).join(', ')
      return `    - ${g.fullName}${tags ? ` (${tags})` : ''}${g.dietary ? ` · dieta: ${g.dietary}` : ''}${g.notes ? ` · notas: ${g.notes}` : ''}`
    }).join('\n')
    return `- ${table.name} (${table.type === 'round' ? 'redonda' : 'rectangular'}, posición x=${table.x.toFixed(1)}m y=${table.y.toFixed(1)}m, ${occupants.length}/${table.capacity} ocupadas):\n${guestLines || '    (vacía)'}`
  }).join('\n\n')

  const featuresDescription = scenario.roomFeatures.length > 0
    ? scenario.roomFeatures.map((f) => `- ${FEATURE_LABELS[f.type]} "${f.label}" en x=${f.x.toFixed(1)}m, y=${f.y.toFixed(1)}m`).join('\n')
    : '(No se han marcado elementos adicionales como DJ, baños o puertas en este escenario.)'

  const unassignedLine = unassigned.length > 0
    ? `Invitados sin mesa asignada (${unassigned.length}): ${unassigned.map((g) => g.fullName).join(', ')}`
    : 'Todos los invitados tienen mesa asignada.'

  return `Eres un wedding planner experto en organización de banquetes. Analiza el siguiente seating plan de la boda de ${coupleNames || 'los novios'} y da una valoración profesional en español.

SALA: ${scenario.room.widthMeters}m x ${scenario.room.heightMeters}m.

ELEMENTOS DE LA SALA:
${featuresDescription}

MESAS E INVITADOS:
${tablesDescription || '(No hay mesas creadas todavía.)'}

${unassignedLine}

Ten en cuenta especialmente:
1. Si la mesa de los novios (invitados marcados como NOVIOS) está bien situada: visible, accesible, y no pegada a elementos molestos (baños, altavoces del DJ) ni demasiado lejos de la pista de baile si existe.
2. Si hay mesas cerca del DJ que puedan sufrir mucho ruido, o mesas mal ubicadas junto a puertas con corrientes de paso constante.
3. Si los roles y grupos declarados (familiares, amigos, compañeros de trabajo) están razonablemente agrupados o si hay mezclas que puedan resultar incómodas.
4. Mesas con muy poca o demasiada ocupación respecto a su capacidad.
5. Cualquier otro aspecto relevante de la disposición espacial general.

Responde de forma clara y estructurada, en un máximo de 350 palabras, con un tono cercano pero profesional. Usa un breve encabezado por bloque temático en vez de un único párrafo largo.`
}

export interface RunAnalysisParams {
  apiKey: string
  model: string
  scenario: Scenario
  guests: Guest[]
  coupleNames: string
}

/** Llama a la API de Anthropic directamente desde el navegador con la clave del propio usuario. */
export async function runSeatingAnalysis({ apiKey, model, scenario, guests, coupleNames }: RunAnalysisParams): Promise<string> {
  if (!apiKey.trim()) {
    throw new AIAnalysisError('Añade primero tu clave de API de Anthropic para poder analizar el seating.')
  }
  if (scenario.tables.length === 0) {
    throw new AIAnalysisError('Añade al menos una mesa antes de pedir un análisis.')
  }

  const prompt = buildPrompt(scenario, guests, coupleNames)

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model || DEFAULT_AI_MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    })
  } catch {
    throw new AIAnalysisError('No se ha podido conectar con la API de Anthropic. Comprueba tu conexión a internet.')
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AIAnalysisError('La clave de API no es válida o ha caducado. Revísala en console.anthropic.com.')
    }
    if (response.status === 404) {
      throw new AIAnalysisError(`El modelo "${model}" no está disponible con tu clave. Prueba con otro nombre de modelo.`)
    }
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message ?? ''
    } catch {
      /* ignore */
    }
    throw new AIAnalysisError(`Error al llamar a la API de Anthropic (${response.status}). ${detail}`)
  }

  const data = await response.json()
  const text = (data?.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n')

  if (!text.trim()) {
    throw new AIAnalysisError('La IA no ha devuelto ningún contenido. Inténtalo de nuevo.')
  }

  return text.trim()
}
