import { create } from 'zustand'
import { produce } from 'immer'
import type {
  ConfirmationStatus,
  AIAnalysisResult,
  Guest,
  GuestGroup,
  Incompatibility,
  Project,
  RoomFeature,
  RoomFeatureType,
  RoomSettings,
  Scenario,
  TableItem,
  TableType,
  ViewMode
} from '@/types'
import { createId } from '@/utils/id'
import { DEMO_GROUPS, generateDemoGuests, generateDemoIncompatibilities } from '@/services/demoData'
import { fetchGuestsFromUrl, mergePreservingAssignments, GuestServiceError } from '@/services/guestService'
import { loadProject, saveProjectDebounced } from '@/services/storageService'
import { runSeatingAnalysis, AIAnalysisError } from '@/services/aiAnalysisService'
import { defaultSeatsPerSide, computeAbsoluteSeatPositions, snap, clamp } from '@/utils/geometry'
import { HistoryStack, type HistorySnapshot } from './history'

const DEFAULT_ROOM: RoomSettings = {
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

const TABLE_PALETTE = [
  '#7C8A5A', // verde oliva
  '#A9B48C', // verde salvia
  '#C1652F', // terracota
  '#D9C8A9', // arena
  '#C9B896', // beige
  '#9C9284', // piedra
  '#8A5A44', // marrón tierra
  '#5D7A8C', // azul mediterráneo
  '#C9A54B' // amarillo trigo
]

export function nextPaletteColor(existingCount: number): string {
  return TABLE_PALETTE[existingCount % TABLE_PALETTE.length]
}

function freshScenario(name: string): Scenario {
  const now = Date.now()
  return {
    id: createId('scenario'),
    name,
    room: { ...DEFAULT_ROOM },
    tables: [],
    roomFeatures: [],
    createdAt: now,
    updatedAt: now
  }
}

function freshProject(): Project {
  const scenario = freshScenario('Distribución inicial')
  return {
    id: createId('project'),
    settings: { coupleNames: 'Nuestra boda', weddingDate: '' },
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    guests: [],
    groups: DEMO_GROUPS,
    incompatibilities: [],
    guestSheetUrl: 'https://docs.google.com/spreadsheets/d/17JddBH3Hp6IPow7tyCG3XGoUp9NXIMiGKTZBBCeQAnY/edit?usp=sharing',
    lastGuestSync: null
  }
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface UIState {
  viewMode: ViewMode
  selectedTableId: string | null
  selectedFeatureId: string | null
  selectedGuestIds: string[]
  zoom: number
  pan: { x: number; y: number }
  guestLoadStatus: 'idle' | 'loading' | 'success' | 'error'
  guestLoadError: string | null
  toasts: Toast[]
  hasSeenOnboarding: boolean
  aiAnalysisStatus: 'idle' | 'loading' | 'success' | 'error'
  aiAnalysisError: string | null
  aiAnalysisResult: AIAnalysisResult | null
}

interface ProjectStore {
  project: Project
  ui: UIState
  history: HistoryStack

  // bootstrap
  init: () => void

  // scenarios
  createScenario: (name: string) => void
  duplicateScenario: (id: string) => void
  renameScenario: (id: string, name: string) => void
  deleteScenario: (id: string) => void
  setActiveScenario: (id: string) => void
  updateRoomSettings: (partial: Partial<RoomSettings>) => void

  // tables
  addTable: (type: TableType) => string
  updateTable: (id: string, partial: Partial<TableItem>) => void
  moveTable: (id: string, x: number, y: number) => void
  duplicateTable: (id: string) => void
  deleteTable: (id: string) => void
  deleteTables: (ids: string[]) => void

  // guests
  loadDemoGuests: () => void
  syncGuestsFromSheet: (url?: string) => Promise<void>
  setGuestSheetUrl: (url: string) => void
  assignGuestToSeat: (guestId: string, tableId: string, seatIndex: number) => void
  assignGuestsToTable: (guestIds: string[], tableId: string) => void
  unassignGuest: (guestId: string) => void
  updateGuest: (id: string, partial: Partial<Guest>) => void
  autoDistribute: (mode: 'random' | 'byGroup' | 'balanced', tableIds?: string[]) => void

  // incompatibilidades
  addIncompatibility: (guestAId: string, guestBId: string, note?: string) => void
  removeIncompatibility: (id: string) => void

  // elementos de la sala (DJ, baños, puertas...)
  addRoomFeature: (type: RoomFeatureType, label: string) => string
  updateRoomFeature: (id: string, partial: Partial<RoomFeature>) => void
  moveRoomFeature: (id: string, x: number, y: number) => void
  deleteRoomFeature: (id: string) => void
  selectFeature: (id: string | null) => void

  // análisis con IA
  runAIAnalysis: (apiKey: string, model: string) => Promise<void>
  clearAIAnalysis: () => void

  // groups
  addGroup: (name: string, color: string) => void
  updateGroup: (id: string, partial: Partial<GuestGroup>) => void
  deleteGroup: (id: string) => void

  // selection & ui
  setViewMode: (mode: ViewMode) => void
  selectTable: (id: string | null) => void
  setSelectedGuestIds: (ids: string[]) => void
  setZoom: (zoom: number) => void
  setPan: (pan: { x: number; y: number }) => void
  dismissOnboarding: () => void

  // toasts
  pushToast: (type: Toast['type'], message: string) => void
  dismissToast: (id: string) => void

  // history
  undo: () => void
  redo: () => void
  pushHistorySnapshot: () => void

  // project io
  replaceProject: (project: Project) => void
  updateSettings: (partial: Partial<Project['settings']>) => void
}

const historyStack = new HistoryStack()
const HISTORY_STORAGE_KEY = 'seating-plan-boda:history:v1'

function snapshotOf(project: Project): HistorySnapshot {
  return {
    scenarios: project.scenarios,
    activeScenarioId: project.activeScenarioId,
    guests: project.guests,
    incompatibilities: project.incompatibilities
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyStack.toJSON()))
  } catch {
    /* localStorage no disponible: el histórico simplemente no persistirá */
  }
}

function loadPersistedHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (raw) historyStack.loadFrom(JSON.parse(raw))
  } catch {
    /* ignorar histórico corrupto */
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  function withHistory(recipe: (draft: Project) => void) {
    const { project } = get()
    historyStack.push(snapshotOf(project))
    persistHistory()
    const next = produce(project, recipe)
    set({ project: next })
    saveProjectDebounced(next)
  }

  function activeScenario(project: Project): Scenario {
    const found = project.scenarios.find((s) => s.id === project.activeScenarioId)
    return found ?? project.scenarios[0]
  }

  return {
    project: freshProject(),
    ui: {
      viewMode: 'mapa',
      selectedTableId: null,
      selectedFeatureId: null,
      selectedGuestIds: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      guestLoadStatus: 'idle',
      guestLoadError: null,
      toasts: [],
      hasSeenOnboarding: false,
      aiAnalysisStatus: 'idle',
      aiAnalysisError: null,
      aiAnalysisResult: null
    },
    history: historyStack,

    init: () => {
      const stored = loadProject()
      loadPersistedHistory()
      if (stored && stored.scenarios?.length) {
        // Compatibilidad con proyectos guardados antes de añadir roomFeatures/incompatibilities/showFullSeatNames.
        const migrated: Project = {
          ...stored,
          incompatibilities: stored.incompatibilities ?? [],
          scenarios: stored.scenarios.map((s) => ({
            ...s,
            roomFeatures: s.roomFeatures ?? [],
            room: { ...DEFAULT_ROOM, ...s.room }
          })),
          guests: stored.guests.map((g) => ({ ...g, role: g.role ?? '', isCouple: g.isCouple ?? false }))
        }
        set({ project: migrated, ui: { ...get().ui, hasSeenOnboarding: migrated.guests.length > 0 } })
      } else {
        saveProjectDebounced(get().project, 50)
      }
    },

    createScenario: (name) => {
      withHistory((draft) => {
        const scenario = freshScenario(name)
        draft.scenarios.push(scenario)
        draft.activeScenarioId = scenario.id
      })
      get().pushToast('success', `Escenario "${name}" creado`)
    },

    duplicateScenario: (id) => {
      withHistory((draft) => {
        const original = draft.scenarios.find((s) => s.id === id)
        if (!original) return
        const copy: Scenario = {
          ...JSON.parse(JSON.stringify(original)),
          id: createId('scenario'),
          name: `${original.name} (copia)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        draft.scenarios.push(copy)
        draft.activeScenarioId = copy.id
      })
      get().pushToast('success', 'Escenario duplicado')
    },

    renameScenario: (id, name) => {
      withHistory((draft) => {
        const s = draft.scenarios.find((sc) => sc.id === id)
        if (s) s.name = name
      })
    },

    deleteScenario: (id) => {
      const { project } = get()
      if (project.scenarios.length <= 1) {
        get().pushToast('error', 'Debe existir al menos un escenario')
        return
      }
      withHistory((draft) => {
        draft.scenarios = draft.scenarios.filter((s) => s.id !== id)
        if (draft.activeScenarioId === id) draft.activeScenarioId = draft.scenarios[0].id
        // liberar invitados asignados a mesas de ese escenario si no existen en otros escenarios
        const remainingTableIds = new Set(draft.scenarios.flatMap((s) => s.tables.map((t) => t.id)))
        draft.guests.forEach((g) => {
          if (g.tableId && !remainingTableIds.has(g.tableId)) {
            g.tableId = null
            g.seatIndex = null
          }
        })
      })
      get().pushToast('info', 'Escenario eliminado')
    },

    setActiveScenario: (id) => {
      set((state) => ({ project: { ...state.project, activeScenarioId: id } }))
    },

    updateRoomSettings: (partial) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        Object.assign(scenario.room, partial)
        scenario.updatedAt = Date.now()
      })
    },

    addTable: (type) => {
      const id = createId('table')
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        const count = scenario.tables.length
        const base: TableItem = {
          id,
          name: `Mesa ${count + 1}`,
          type,
          x: clamp(scenario.room.widthMeters / 2, 0, Math.max(scenario.room.widthMeters, 0)),
          y: clamp(scenario.room.heightMeters / 2, 0, Math.max(scenario.room.heightMeters, 0)),
          rotation: 0,
          color: nextPaletteColor(count),
          capacity: type === 'round' ? 8 : 6,
          diameter: type === 'round' ? 1.5 : undefined,
          width: type === 'rect' ? 1.8 : undefined,
          length: type === 'rect' ? 0.9 : undefined,
          seatsPerSide: type === 'rect' ? defaultSeatsPerSide(6) : undefined
        }
        scenario.tables.push(base)
        scenario.updatedAt = Date.now()
      })
      get().selectTable(id)
      return id
    },

    updateTable: (id, partial) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        const table = scenario.tables.find((t) => t.id === id)
        if (!table) return
        Object.assign(table, partial)
        if (partial.capacity !== undefined && table.type === 'rect' && !partial.seatsPerSide) {
          table.seatsPerSide = defaultSeatsPerSide(partial.capacity)
        }
        scenario.updatedAt = Date.now()
        // liberar invitados en asientos que ya no existen
        const validSeats = new Set(computeAbsoluteSeatPositions(table, []).map((s) => s.index))
        draft.guests.forEach((g) => {
          if (g.tableId === id && g.seatIndex !== null && !validSeats.has(g.seatIndex)) {
            g.seatIndex = null
          }
        })
      })
    },

    moveTable: (id, x, y) => {
      const { project } = get()
      const scenario = activeScenario(project)
      const snapped = scenario.room.snapToGrid
      const next = produce(project, (draft) => {
        const s = activeScenario(draft)
        const table = s.tables.find((t) => t.id === id)
        if (!table || table.locked) return
        table.x = snap(x, s.room.gridStepMeters, snapped)
        table.y = snap(y, s.room.gridStepMeters, snapped)
      })
      set({ project: next })
      saveProjectDebounced(next)
    },

    duplicateTable: (id) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        const original = scenario.tables.find((t) => t.id === id)
        if (!original) return
        const copy: TableItem = {
          ...JSON.parse(JSON.stringify(original)),
          id: createId('table'),
          name: `${original.name} (copia)`,
          x: clamp(original.x + 1, 0, Math.max(scenario.room.widthMeters, 0)),
          y: clamp(original.y + 1, 0, Math.max(scenario.room.heightMeters, 0))
        }
        scenario.tables.push(copy)
      })
      get().pushToast('success', 'Mesa duplicada')
    },

    deleteTable: (id) => get().deleteTables([id]),

    deleteTables: (ids) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        scenario.tables = scenario.tables.filter((t) => !ids.includes(t.id))
        draft.guests.forEach((g) => {
          if (g.tableId && ids.includes(g.tableId)) {
            g.tableId = null
            g.seatIndex = null
          }
        })
      })
      set((state) => ({ ui: { ...state.ui, selectedTableId: null } }))
      get().pushToast('info', ids.length > 1 ? 'Mesas eliminadas' : 'Mesa eliminada')
    },

    loadDemoGuests: () => {
      withHistory((draft) => {
        const demoGuests = generateDemoGuests(50)
        draft.guests = demoGuests
        draft.groups = DEMO_GROUPS
        draft.incompatibilities = generateDemoIncompatibilities(demoGuests)
        draft.lastGuestSync = Date.now()
      })
      get().pushToast('success', '50 invitados de ejemplo cargados')
    },

    setGuestSheetUrl: (url) => {
      set((state) => ({ project: { ...state.project, guestSheetUrl: url } }))
      saveProjectDebounced(get().project)
    },

    syncGuestsFromSheet: async (url) => {
      const targetUrl = url ?? get().project.guestSheetUrl
      set((state) => ({ ui: { ...state.ui, guestLoadStatus: 'loading', guestLoadError: null } }))
      try {
        const result = await fetchGuestsFromUrl(targetUrl)
        withHistory((draft) => {
          draft.guests = mergePreservingAssignments(draft.guests, result.guests)
          draft.lastGuestSync = result.fetchedAt
        })
        set((state) => ({ ui: { ...state.ui, guestLoadStatus: 'success', guestLoadError: null } }))
        get().pushToast('success', `${result.guests.length} invitados importados desde Google Sheets`)
      } catch (err) {
        const message = err instanceof GuestServiceError ? err.message : 'Error inesperado al importar invitados.'
        set((state) => ({ ui: { ...state.ui, guestLoadStatus: 'error', guestLoadError: message } }))
        get().pushToast('error', message)
      }
    },

    assignGuestToSeat: (guestId, tableId, seatIndex) => {
      withHistory((draft) => {
        // liberar a cualquier invitado que ya ocupara ese asiento (swap)
        const occupant = draft.guests.find((g) => g.tableId === tableId && g.seatIndex === seatIndex)
        const guest = draft.guests.find((g) => g.id === guestId)
        if (!guest) return
        const prevTableId = guest.tableId
        const prevSeatIndex = guest.seatIndex
        if (occupant && occupant.id !== guestId) {
          occupant.tableId = prevTableId
          occupant.seatIndex = prevSeatIndex
        }
        guest.tableId = tableId
        guest.seatIndex = seatIndex
      })
    },

    assignGuestsToTable: (guestIds, tableId) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        const table = scenario.tables.find((t) => t.id === tableId)
        if (!table) return
        const occupied = new Set(
          draft.guests.filter((g) => g.tableId === tableId && g.seatIndex !== null).map((g) => g.seatIndex)
        )
        const freeSeats: number[] = []
        for (let i = 0; i < table.capacity; i++) if (!occupied.has(i)) freeSeats.push(i)

        guestIds.forEach((guestId) => {
          const guest = draft.guests.find((g) => g.id === guestId)
          if (!guest) return
          guest.tableId = tableId
          const seat = freeSeats.shift()
          guest.seatIndex = seat !== undefined ? seat : null
        })
      })
      get().pushToast('success', `${guestIds.length} invitado(s) asignado(s)`)
    },

    unassignGuest: (guestId) => {
      withHistory((draft) => {
        const guest = draft.guests.find((g) => g.id === guestId)
        if (guest) {
          guest.tableId = null
          guest.seatIndex = null
        }
      })
    },

    updateGuest: (id, partial) => {
      withHistory((draft) => {
        const guest = draft.guests.find((g) => g.id === id)
        if (guest) Object.assign(guest, partial)
      })
    },

    autoDistribute: (mode, tableIds) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        const tables = scenario.tables.filter((t) => !tableIds || tableIds.includes(t.id))
        if (tables.length === 0) return

        const unassigned = draft.guests.filter((g) => !g.tableId)
        const capacityLeft = new Map(
          tables.map((t) => [
            t.id,
            t.capacity - draft.guests.filter((g) => g.tableId === t.id).length
          ])
        )
        const seatsTaken = new Map(
          tables.map((t) => [t.id, new Set(draft.guests.filter((g) => g.tableId === t.id).map((g) => g.seatIndex))])
        )

        // mapa de incompatibilidades: guestId -> Set de guestIds con los que no debe compartir mesa
        const incompatMap = new Map<string, Set<string>>()
        draft.incompatibilities.forEach((inc) => {
          if (!incompatMap.has(inc.guestAId)) incompatMap.set(inc.guestAId, new Set())
          if (!incompatMap.has(inc.guestBId)) incompatMap.set(inc.guestBId, new Set())
          incompatMap.get(inc.guestAId)!.add(inc.guestBId)
          incompatMap.get(inc.guestBId)!.add(inc.guestAId)
        })

        function tableHasConflict(guest: Guest, tableId: string): boolean {
          const forbidden = incompatMap.get(guest.id)
          if (!forbidden || forbidden.size === 0) return false
          return draft.guests.some((g) => g.tableId === tableId && forbidden.has(g.id))
        }

        function placeGuest(guest: Guest, tableId: string) {
          const left = capacityLeft.get(tableId) ?? 0
          if (left <= 0) return false
          const taken = seatsTaken.get(tableId)!
          const table = tables.find((t) => t.id === tableId)!
          let seat = -1
          for (let i = 0; i < table.capacity; i++) {
            if (!taken.has(i)) {
              seat = i
              break
            }
          }
          guest.tableId = tableId
          guest.seatIndex = seat !== -1 ? seat : null
          taken.add(seat)
          capacityLeft.set(tableId, left - 1)
          return true
        }

        function tablesBySpaceDesc(): string[] {
          return [...capacityLeft.entries()]
            .filter(([, space]) => space > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id)
        }

        function tableWithMostSpace(): string | null {
          return tablesBySpaceDesc()[0] ?? null
        }

        /** Elige la mejor mesa con espacio para este invitado, evitando incompatibilidades cuando sea posible. */
        function bestTableFor(guest: Guest, preferredTableId?: string | null): string | null {
          const ranked = preferredTableId
            ? [preferredTableId, ...tablesBySpaceDesc().filter((id) => id !== preferredTableId)]
            : tablesBySpaceDesc()
          const withoutConflict = ranked.find((id) => (capacityLeft.get(id) ?? 0) > 0 && !tableHasConflict(guest, id))
          if (withoutConflict) return withoutConflict
          // sin alternativa: usar la mejor con espacio aunque genere un aviso de incompatibilidad
          return ranked.find((id) => (capacityLeft.get(id) ?? 0) > 0) ?? null
        }

        if (mode === 'random') {
          const shuffled = [...unassigned].sort(() => Math.random() - 0.5)
          shuffled.forEach((guest) => {
            const tableId = bestTableFor(guest)
            if (tableId) placeGuest(guest, tableId)
          })
        } else if (mode === 'byGroup') {
          const byGroup = new Map<string, Guest[]>()
          unassigned.forEach((g) => {
            const key = g.group || 'Sin grupo'
            if (!byGroup.has(key)) byGroup.set(key, [])
            byGroup.get(key)!.push(g)
          })
          byGroup.forEach((groupGuests) => {
            let tableId = tableWithMostSpace()
            groupGuests.forEach((guest) => {
              const chosen = bestTableFor(guest, tableId)
              if (chosen) {
                placeGuest(guest, chosen)
                tableId = chosen
              }
            })
          })
        } else {
          // balanced: round-robin entre mesas con espacio, evitando incompatibilidades
          let idx = 0
          const tableIdsList = tables.map((t) => t.id)
          unassigned.forEach((guest) => {
            let placed = false
            let attempts = 0
            while (attempts < tableIdsList.length) {
              const candidate = tableIdsList[idx % tableIdsList.length]
              idx++
              attempts++
              if ((capacityLeft.get(candidate) ?? 0) > 0 && !tableHasConflict(guest, candidate)) {
                placeGuest(guest, candidate)
                placed = true
                break
              }
            }
            if (!placed) {
              const fallback = tableWithMostSpace()
              if (fallback) placeGuest(guest, fallback)
            }
          })
        }
      })
      get().pushToast('success', 'Distribución automática aplicada')
    },

    addIncompatibility: (guestAId, guestBId, note) => {
      if (guestAId === guestBId) return
      withHistory((draft) => {
        const exists = draft.incompatibilities.some(
          (i) => (i.guestAId === guestAId && i.guestBId === guestBId) || (i.guestAId === guestBId && i.guestBId === guestAId)
        )
        if (exists) return
        draft.incompatibilities.push({ id: createId('incomp'), guestAId, guestBId, note })
      })
      get().pushToast('success', 'Incompatibilidad añadida')
    },

    removeIncompatibility: (id) => {
      withHistory((draft) => {
        draft.incompatibilities = draft.incompatibilities.filter((i) => i.id !== id)
      })
    },

    addRoomFeature: (type, label) => {
      const id = createId('feature')
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        scenario.roomFeatures.push({
          id,
          type,
          label,
          x: clamp(scenario.room.widthMeters / 2, 0, Math.max(scenario.room.widthMeters, 0)),
          y: clamp(0.6, 0, Math.max(scenario.room.heightMeters, 0)),
          rotation: 0
        })
      })
      get().selectFeature(id)
      return id
    },

    updateRoomFeature: (id, partial) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        const feature = scenario.roomFeatures.find((f) => f.id === id)
        if (feature) Object.assign(feature, partial)
      })
    },

    moveRoomFeature: (id, x, y) => {
      const { project } = get()
      const scenario = activeScenario(project)
      const snapped = scenario.room.snapToGrid
      const next = produce(project, (draft) => {
        const s = activeScenario(draft)
        const feature = s.roomFeatures.find((f) => f.id === id)
        if (!feature) return
        feature.x = snap(x, s.room.gridStepMeters, snapped)
        feature.y = snap(y, s.room.gridStepMeters, snapped)
      })
      set({ project: next })
      saveProjectDebounced(next)
    },

    deleteRoomFeature: (id) => {
      withHistory((draft) => {
        const scenario = activeScenario(draft)
        scenario.roomFeatures = scenario.roomFeatures.filter((f) => f.id !== id)
      })
      set((state) => ({ ui: { ...state.ui, selectedFeatureId: null } }))
    },

    selectFeature: (id) => set((state) => ({ ui: { ...state.ui, selectedFeatureId: id, selectedTableId: null, selectedGuestIds: [] } })),

    runAIAnalysis: async (apiKey, model) => {
      const { project } = get()
      const scenario = activeScenario(project)
      set((state) => ({ ui: { ...state.ui, aiAnalysisStatus: 'loading', aiAnalysisError: null } }))
      try {
        const content = await runSeatingAnalysis({
          apiKey,
          model,
          scenario,
          guests: project.guests,
          coupleNames: project.settings.coupleNames
        })
        const result: AIAnalysisResult = {
          id: createId('analysis'),
          scenarioId: scenario.id,
          createdAt: Date.now(),
          model,
          content
        }
        set((state) => ({
          ui: { ...state.ui, aiAnalysisStatus: 'success', aiAnalysisError: null, aiAnalysisResult: result }
        }))
      } catch (err) {
        const message = err instanceof AIAnalysisError ? err.message : 'Error inesperado al analizar el seating.'
        set((state) => ({ ui: { ...state.ui, aiAnalysisStatus: 'error', aiAnalysisError: message } }))
        get().pushToast('error', message)
      }
    },

    clearAIAnalysis: () => {
      set((state) => ({ ui: { ...state.ui, aiAnalysisStatus: 'idle', aiAnalysisError: null, aiAnalysisResult: null } }))
    },

    addGroup: (name, color) => {
      withHistory((draft) => {
        draft.groups.push({ id: createId('group'), name, color })
      })
    },

    updateGroup: (id, partial) => {
      withHistory((draft) => {
        const g = draft.groups.find((gr) => gr.id === id)
        if (g) Object.assign(g, partial)
      })
    },

    deleteGroup: (id) => {
      withHistory((draft) => {
        draft.groups = draft.groups.filter((g) => g.id !== id)
      })
    },

    setViewMode: (mode) => set((state) => ({ ui: { ...state.ui, viewMode: mode } })),
    selectTable: (id) => set((state) => ({ ui: { ...state.ui, selectedTableId: id, selectedFeatureId: null, selectedGuestIds: [] } })),
    setSelectedGuestIds: (ids) => set((state) => ({ ui: { ...state.ui, selectedGuestIds: ids } })),
    setZoom: (zoom) => set((state) => ({ ui: { ...state.ui, zoom: clamp(zoom, 0.25, 2) } })),
    setPan: (pan) => set((state) => ({ ui: { ...state.ui, pan } })),
    dismissOnboarding: () => set((state) => ({ ui: { ...state.ui, hasSeenOnboarding: true } })),

    pushToast: (type, message) => {
      const id = createId('toast')
      set((state) => ({ ui: { ...state.ui, toasts: [...state.ui.toasts, { id, type, message }] } }))
      setTimeout(() => get().dismissToast(id), 4200)
    },
    dismissToast: (id) => set((state) => ({ ui: { ...state.ui, toasts: state.ui.toasts.filter((t) => t.id !== id) } })),

    undo: () => {
      const { project } = get()
      const prev = historyStack.undo(snapshotOf(project))
      if (!prev) return
      persistHistory()
      const next = { ...project, ...prev }
      set({ project: next })
      saveProjectDebounced(next)
    },

    redo: () => {
      const { project } = get()
      const nextSnap = historyStack.redo(snapshotOf(project))
      if (!nextSnap) return
      persistHistory()
      const next = { ...project, ...nextSnap }
      set({ project: next })
      saveProjectDebounced(next)
    },

    pushHistorySnapshot: () => {
      historyStack.push(snapshotOf(get().project))
      persistHistory()
    },

    replaceProject: (project) => {
      historyStack.reset()
      persistHistory()
      set((state) => ({ project, ui: { ...state.ui, selectedTableId: null, selectedFeatureId: null, selectedGuestIds: [] } }))
      saveProjectDebounced(project, 50)
    },

    updateSettings: (partial) => {
      withHistory((draft) => {
        Object.assign(draft.settings, partial)
      })
    }
  }
})

export function useActiveScenario(): Scenario {
  const project = useProjectStore((s) => s.project)
  return project.scenarios.find((s) => s.id === project.activeScenarioId) ?? project.scenarios[0]
}

export type { ConfirmationStatus }
