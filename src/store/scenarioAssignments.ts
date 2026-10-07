import type { Guest, Project, ProjectSettings, RoomSettings, Scenario, SeatAssignment } from '@/types'
import { normalizeDietary } from '@/utils/dietary'
import { computeSeatPositions } from '@/utils/geometry'

/**
 * Reparto por escenario
 * ---------------------
 * Cada escenario guarda su propio reparto en `scenario.assignments`.
 * `guest.tableId` / `guest.seatIndex` funcionan como espejo del escenario ACTIVO
 * para que el resto de la app (lienzo, listas, validaciones) no tenga que cambiar:
 *   - al cambiar de escenario se vuelca el espejo al escenario saliente y se carga el entrante;
 *   - tras cada edición, el store vuelca el espejo al escenario activo.
 */

export const CURRENT_SCHEMA_VERSION = 2

export const DEFAULT_ROOM: RoomSettings = {
  widthMeters: 20,
  heightMeters: 16,
  showGrid: true,
  snapToGrid: true,
  showMeasurements: true,
  showTableNames: true,
  showGuestCount: true,
  showFullSeatNames: false,
  gridStepMeters: 0.5
}

/** Datos de la boda por defecto (también se aplican a proyectos antiguos sin rellenar). */
export const DEFAULT_SETTINGS: ProjectSettings = {
  coupleNames: 'Cati & Tomeu',
  weddingDate: '2026-10-17',
  venue: 'Els Calderers'
}

export function deepClone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T)
}

/** Lee el espejo de los invitados y lo convierte en un mapa de asignaciones. */
export function captureAssignments(guests: Guest[]): Record<string, SeatAssignment> {
  const out: Record<string, SeatAssignment> = {}
  guests.forEach((g) => {
    if (g.tableId) out[g.id] = { tableId: g.tableId, seatIndex: g.seatIndex }
  })
  return out
}

export function sameAssignments(a: Record<string, SeatAssignment>, b: Record<string, SeatAssignment>): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => b[k] && b[k].tableId === a[k].tableId && b[k].seatIndex === a[k].seatIndex)
}

/**
 * Carga el reparto de un escenario en el espejo de los invitados, validando que
 * la mesa exista y el asiento esté dentro de la capacidad y no esté duplicado.
 * Devuelve cuántas asignaciones no eran válidas (esos invitados quedan sin mesa).
 */
export function applyAssignments(guests: Guest[], scenario: Scenario): number {
  const validSeats = new Map(
    scenario.tables.map((t) => [t.id, new Set(computeSeatPositions(t, []).map((s) => s.index))])
  )
  const taken = new Set<string>()
  let invalid = 0
  guests.forEach((g) => {
    const a = scenario.assignments?.[g.id]
    g.tableId = null
    g.seatIndex = null
    if (!a) return
    const seats = validSeats.get(a.tableId)
    if (!seats) {
      invalid++
      return
    }
    g.tableId = a.tableId
    if (a.seatIndex !== null && seats.has(a.seatIndex) && !taken.has(`${a.tableId}:${a.seatIndex}`)) {
      g.seatIndex = a.seatIndex
      taken.add(`${a.tableId}:${a.seatIndex}`)
    } else if (a.seatIndex !== null) {
      // asiento inexistente o duplicado: se queda en la mesa pero sin silla concreta
      invalid++
    }
  })
  return invalid
}

/** Elimina de todos los escenarios las asignaciones de invitados que ya no existen. */
export function pruneAssignments(project: Project) {
  const ids = new Set(project.guests.map((g) => g.id))
  project.scenarios.forEach((s) => {
    Object.keys(s.assignments).forEach((gid) => {
      if (!ids.has(gid)) delete s.assignments[gid]
    })
  })
}

export function findScenario(project: Project, id: string): Scenario {
  return project.scenarios.find((s) => s.id === id) ?? project.scenarios[0]
}

/** Cambia de escenario activo guardando el espejo en el saliente y cargando el entrante. */
export function switchActiveScenario(project: Project, targetId: string): number {
  const current = findScenario(project, project.activeScenarioId)
  current.assignments = captureAssignments(project.guests)
  const target = project.scenarios.find((s) => s.id === targetId)
  if (!target) return 0
  project.activeScenarioId = target.id
  return applyAssignments(project.guests, target)
}

/** Devuelve los invitados con la mesa/asiento de un escenario concreto (sin tocar el store). */
export function guestsForScenario(project: Project, scenarioId: string): Guest[] {
  if (scenarioId === project.activeScenarioId) return project.guests
  const scenario = project.scenarios.find((s) => s.id === scenarioId)
  if (!scenario) return project.guests
  const copy = project.guests.map((g) => ({ ...g }))
  applyAssignments(copy, scenario)
  return copy
}

export interface MigrationResult {
  project: Project
  /** True si el proyecto venía en un formato anterior y se ha transformado. */
  migrated: boolean
  /** Asignaciones descartadas por apuntar a mesas/asientos inexistentes. */
  invalidAssignments: number
}

/**
 * Normaliza cualquier proyecto (localStorage o archivo importado) al formato actual.
 * Formato antiguo: el reparto vive en guest.tableId/seatIndex y es común a todos los escenarios.
 * Como no hay más información, ese reparto se copia a TODOS los escenarios (solo a las mesas
 * que existan en cada uno). A partir de aquí cada escenario evoluciona por separado.
 */
export function migrateProject(raw: Project): MigrationResult {
  const input = deepClone(raw) as Project & { guests: (Guest & { dietary: unknown })[] }
  const migrated = (input.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION

  const guests: Guest[] = (input.guests ?? []).map((g) => ({
    ...g,
    role: g.role ?? '',
    isCouple: g.isCouple ?? false,
    notes: g.notes ?? '',
    dietary: normalizeDietary(g.dietary),
    gift: g.gift && typeof g.gift === 'object' ? { description: String((g.gift as { description?: unknown }).description ?? '') } : null,
    tableId: g.tableId ?? null,
    seatIndex: g.seatIndex ?? null
  }))

  const scenarios: Scenario[] = (input.scenarios ?? []).map((s) => {
    const tableIds = new Set((s.tables ?? []).map((t) => t.id))
    let assignments = s.assignments
    if (!assignments || typeof assignments !== 'object') {
      assignments = {}
      guests.forEach((g) => {
        if (g.tableId && tableIds.has(g.tableId)) assignments![g.id] = { tableId: g.tableId, seatIndex: g.seatIndex }
      })
    }
    return {
      ...s,
      tables: s.tables ?? [],
      roomFeatures: s.roomFeatures ?? [],
      room: { ...DEFAULT_ROOM, ...s.room },
      assignments
    }
  })

  const project: Project = {
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      coupleNames:
        !input.settings?.coupleNames || input.settings.coupleNames === 'Nuestra boda'
          ? DEFAULT_SETTINGS.coupleNames
          : input.settings.coupleNames,
      weddingDate: input.settings?.weddingDate || DEFAULT_SETTINGS.weddingDate,
      venue: input.settings?.venue ?? DEFAULT_SETTINGS.venue
    },
    incompatibilities: input.incompatibilities ?? [],
    groups: input.groups ?? [],
    scenarios,
    guests,
    activeScenarioId: scenarios.some((s) => s.id === input.activeScenarioId) ? input.activeScenarioId : scenarios[0]?.id
  }

  let invalidAssignments = 0
  if (project.scenarios.length) {
    pruneAssignments(project)
    const active = findScenario(project, project.activeScenarioId)
    invalidAssignments = applyAssignments(project.guests, active)
    active.assignments = captureAssignments(project.guests)
  }

  return { project, migrated, invalidAssignments }
}
