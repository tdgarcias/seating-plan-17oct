import type { Guest, Incompatibility, Scenario, ValidationIssue } from '@/types'
import { tableOutOfBounds, tablesOverlap } from './geometry'

export function computeValidationIssues(
  scenario: Scenario,
  guests: Guest[],
  incompatibilities: Incompatibility[] = []
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { tables, room } = scenario

  tables.forEach((table) => {
    const occupants = guests.filter((g) => g.tableId === table.id)
    if (occupants.length > table.capacity) {
      issues.push({
        id: `overcap-${table.id}`,
        severity: 'error',
        tableId: table.id,
        message: `${table.name} tiene ${occupants.length} invitados pero solo ${table.capacity} plazas.`
      })
    } else if (occupants.length < table.capacity) {
      issues.push({
        id: `space-${table.id}`,
        severity: 'info',
        tableId: table.id,
        message: `${table.name} tiene ${table.capacity - occupants.length} plaza(s) libre(s).`
      })
    }

    if (tableOutOfBounds(table, room)) {
      issues.push({
        id: `bounds-${table.id}`,
        severity: 'warning',
        tableId: table.id,
        message: `${table.name} está fuera de los límites de la sala.`
      })
    }
  })

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (tablesOverlap(tables[i], tables[j])) {
        issues.push({
          id: `overlap-${tables[i].id}-${tables[j].id}`,
          severity: 'warning',
          tableId: tables[i].id,
          message: `${tables[i].name} y ${tables[j].name} se están solapando.`
        })
      }
    }
  }

  // invitados duplicados (mismo nombre completo, más de una vez)
  const seen = new Map<string, number>()
  guests.forEach((g) => {
    const key = g.fullName.toLowerCase().trim()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  })
  seen.forEach((count, name) => {
    if (count > 1) {
      issues.push({
        id: `dup-${name}`,
        severity: 'warning',
        message: `"${name}" aparece ${count} veces en la lista de invitados.`
      })
    }
  })

  const unassigned = guests.filter((g) => !g.tableId)
  if (unassigned.length > 0) {
    issues.push({
      id: 'unassigned',
      severity: 'info',
      message: `${unassigned.length} invitado(s) todavía no tienen mesa.`
    })
  }

  // incompatibilidades: invitados marcados como "no sentar juntos" compartiendo mesa
  const guestById = new Map(guests.map((g) => [g.id, g]))
  incompatibilities.forEach((inc) => {
    const a = guestById.get(inc.guestAId)
    const b = guestById.get(inc.guestBId)
    if (a && b && a.tableId && a.tableId === b.tableId) {
      const table = tables.find((t) => t.id === a.tableId)
      issues.push({
        id: `incompat-${inc.id}`,
        severity: 'error',
        tableId: a.tableId,
        message: `${a.fullName} y ${b.fullName} están en la misma mesa (${table?.name ?? ''}) pero se marcaron como incompatibles.`
      })
    }
  })

  return issues
}
