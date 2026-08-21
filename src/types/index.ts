/**
 * Modelos de datos centrales de la aplicación.
 * Mantener este archivo como única fuente de verdad para las formas de datos.
 */

export type ConfirmationStatus = 'confirmado' | 'pendiente' | 'rechazado'

/** Roles habituales sugeridos; el campo es texto libre para admitir cualquier otro. */
export const SUGGESTED_ROLES = ['Familiar', 'Amigo/a', 'Compañero/a de trabajo', 'Pareja de invitado', 'Proveedor', 'Otro'] as const

export interface Guest {
  id: string
  firstName: string
  lastName: string
  fullName: string
  group: string
  companions: number
  status: ConfirmationStatus
  notes: string
  dietary: string
  /** Rol del invitado respecto a los novios (familiar, amigo, compañero de trabajo...). Texto libre. */
  role: string
  /** True si este invitado ES uno de los novios (detectado en la hoja o marcado manualmente). */
  isCouple: boolean
  /** Fila original en la hoja de origen, si procede (para depuración/reimportación). */
  sourceRow?: number
  /** Asignación actual. Ambos null si no está colocado. */
  tableId: string | null
  seatIndex: number | null
}

export interface GuestGroup {
  id: string
  name: string
  color: string
}

/** Pareja de invitados que no deberían compartir mesa. Vive a nivel de proyecto para no duplicar datos. */
export interface Incompatibility {
  id: string
  guestAId: string
  guestBId: string
  note?: string
}

export type TableType = 'round' | 'rect'

export interface SeatsPerSide {
  top: number
  bottom: number
  left: number
  right: number
}

export interface TableItem {
  id: string
  name: string
  type: TableType
  /** Centro de la mesa, en metros, relativo a la esquina superior izquierda de la sala. */
  x: number
  y: number
  /** Grados, sentido horario. */
  rotation: number
  color: string
  /** Nº total de comensales/asientos. */
  capacity: number
  /** Sólo para mesas redondas: diámetro en metros. */
  diameter?: number
  /** Sólo para mesas rectangulares: dimensiones en metros. */
  width?: number
  length?: number
  /** Sólo para mesas rectangulares: distribución explícita de asientos por lado (opcional). */
  seatsPerSide?: SeatsPerSide
  locked?: boolean
}

export type RoomFeatureType = 'dj' | 'banos' | 'puerta' | 'barra' | 'pista' | 'otro'

/** Elemento no ocupable de la sala (DJ, baños, puertas, barra, pista de baile...) usado como referencia visual y para el análisis de IA. */
export interface RoomFeature {
  id: string
  type: RoomFeatureType
  label: string
  x: number
  y: number
  rotation: number
}

export interface RoomSettings {
  widthMeters: number
  heightMeters: number
  showGrid: boolean
  snapToGrid: boolean
  showMeasurements: boolean
  showTableNames: boolean
  showGuestCount: boolean
  /** Si es true, los asientos muestran el nombre completo del invitado en vez de sus iniciales. */
  showFullSeatNames: boolean
  gridStepMeters: number
}

export interface Scenario {
  id: string
  name: string
  room: RoomSettings
  tables: TableItem[]
  roomFeatures: RoomFeature[]
  createdAt: number
  updatedAt: number
}

export interface ProjectSettings {
  coupleNames: string
  weddingDate: string
}

export interface Project {
  id: string
  settings: ProjectSettings
  scenarios: Scenario[]
  activeScenarioId: string
  guests: Guest[]
  groups: GuestGroup[]
  incompatibilities: Incompatibility[]
  guestSheetUrl: string
  lastGuestSync: number | null
}

export type ViewMode = 'mapa' | 'organizar' | 'presentacion'

export interface SeatPosition {
  index: number
  x: number
  y: number
  /** Ángulo, en grados, hacia fuera de la mesa (para orientar la etiqueta). */
  angle: number
  guest: Guest | null
}

export interface ValidationIssue {
  id: string
  severity: 'warning' | 'error' | 'info'
  message: string
  tableId?: string
  guestId?: string
}

export interface GuestColumnMapping {
  firstName?: string
  lastName?: string
  fullName?: string
  group?: string
  companions?: string
  status?: string
  notes?: string
  dietary?: string
  table?: string
  role?: string
}

export type GuestLoadStatus = 'idle' | 'loading' | 'success' | 'error'

/** Resultado de un análisis de IA sobre el seating de un escenario. */
export interface AIAnalysisResult {
  id: string
  scenarioId: string
  createdAt: number
  model: string
  content: string
}
