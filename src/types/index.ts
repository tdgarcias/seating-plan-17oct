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
  /** Alergias, intolerancias y dietas especiales (estructurado). */
  dietary: DietaryInfo
  /** Rol del invitado respecto a los novios (familiar, amigo, compañero de trabajo...). Texto libre. */
  role: string
  /** True si este invitado ES uno de los novios (detectado en la hoja o marcado manualmente). */
  isCouple: boolean
  /** Fila original en la hoja de origen, si procede (para depuración/reimportación). */
  sourceRow?: number
  /**
   * Asignación en el ESCENARIO ACTIVO. Es un espejo de `activeScenario.assignments[guest.id]`:
   * se recarga al cambiar de escenario y se vuelca al escenario activo tras cada cambio.
   * La fuente de verdad de cada escenario es `Scenario.assignments`.
   */
  tableId: string | null
  seatIndex: number | null
}

/** Los 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011). */
export type AllergenCode =
  | 'gluten' | 'crustaceos' | 'huevo' | 'pescado' | 'cacahuete' | 'soja' | 'lacteos'
  | 'frutos_cascara' | 'apio' | 'mostaza' | 'sesamo' | 'sulfitos' | 'altramuces' | 'moluscos'

export type DietCode = 'vegetariano' | 'vegano' | 'sin_cerdo' | 'halal' | 'kosher' | 'embarazada' | 'infantil'

export type DietarySeverity = 'alergia' | 'intolerancia' | 'preferencia'

export interface DietaryInfo {
  allergens: AllergenCode[]
  diets: DietCode[]
  severity: DietarySeverity | null
  /** Texto libre: "celíaca estricta, cuidado con contaminación cruzada". */
  notes: string
  /** Último texto leído de la columna de alergias de Google Sheets (para detectar cambios). */
  sheetText?: string
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

/** Dónde se sienta un invitado dentro de un escenario concreto. */
export interface SeatAssignment {
  tableId: string
  seatIndex: number | null
}

export interface Scenario {
  id: string
  name: string
  room: RoomSettings
  tables: TableItem[]
  roomFeatures: RoomFeature[]
  /** Reparto propio de este escenario: guestId -> mesa/asiento. Independiente de los demás escenarios. */
  assignments: Record<string, SeatAssignment>
  createdAt: number
  updatedAt: number
}

export interface ProjectSettings {
  coupleNames: string
  weddingDate: string
}

export interface Project {
  /** 2 = reparto por escenario + alergias estructuradas. Ausente en proyectos antiguos. */
  schemaVersion?: number
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
