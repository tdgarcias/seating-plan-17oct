import type { Guest, Incompatibility, Scenario } from '@/types'

/** Subconjunto del proyecto que participa en el histórico de deshacer/rehacer. */
export interface HistorySnapshot {
  scenarios: Scenario[]
  activeScenarioId: string
  guests: Guest[]
  incompatibilities: Incompatibility[]
}

const MAX_HISTORY = 60

export class HistoryStack {
  private past: HistorySnapshot[] = []
  private future: HistorySnapshot[] = []

  clone(snapshot: HistorySnapshot): HistorySnapshot {
    return typeof structuredClone === 'function'
      ? structuredClone(snapshot)
      : (JSON.parse(JSON.stringify(snapshot)) as HistorySnapshot)
  }

  push(snapshot: HistorySnapshot) {
    this.past.push(this.clone(snapshot))
    if (this.past.length > MAX_HISTORY) this.past.shift()
    this.future = []
  }

  canUndo() {
    return this.past.length > 0
  }

  canRedo() {
    return this.future.length > 0
  }

  undo(current: HistorySnapshot): HistorySnapshot | null {
    const prev = this.past.pop()
    if (!prev) return null
    this.future.push(this.clone(current))
    return prev
  }

  redo(current: HistorySnapshot): HistorySnapshot | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(this.clone(current))
    return next
  }

  reset() {
    this.past = []
    this.future = []
  }

  /** Serializa el histórico para poder persistirlo entre sesiones (localStorage). */
  toJSON(): { past: HistorySnapshot[]; future: HistorySnapshot[] } {
    return { past: this.past, future: this.future }
  }

  /** Restaura un histórico previamente serializado. */
  loadFrom(data: { past: HistorySnapshot[]; future: HistorySnapshot[] } | null | undefined) {
    if (!data) return
    this.past = Array.isArray(data.past) ? data.past.slice(-MAX_HISTORY) : []
    this.future = Array.isArray(data.future) ? data.future.slice(-MAX_HISTORY) : []
  }
}
