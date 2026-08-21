import { useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'

export default function TablesBoard() {
  const scenario = useActiveScenario()
  const guests = useProjectStore((s) => s.project.guests)
  const assignGuestsToTable = useProjectStore((s) => s.assignGuestsToTable)
  const unassignGuest = useProjectStore((s) => s.unassignGuest)
  const addTable = useProjectStore((s) => s.addTable)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  if (scenario.tables.length === 0) {
    return (
      <div className="tables-board-empty">
        <p className="text-soft">Todavía no has creado ninguna mesa en este escenario.</p>
        <div className="flex gap-2" style={{ marginTop: 12, justifyContent: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={() => addTable('round')}>◯ Añadir mesa redonda</button>
          <button className="btn btn-secondary btn-sm" onClick={() => addTable('rect')}>▭ Añadir mesa rectangular</button>
        </div>
      </div>
    )
  }

  return (
    <div className="tables-board scroll-y">
      {scenario.tables.map((table) => {
        const occupants = guests.filter((g) => g.tableId === table.id)
        const full = occupants.length >= table.capacity
        return (
          <div
            key={table.id}
            className={`table-board-card ${dragOverId === table.id ? 'is-drag-over' : ''}`}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-guest-id')) { e.preventDefault(); setDragOverId(table.id) } }}
            onDragLeave={() => setDragOverId((id) => (id === table.id ? null : id))}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverId(null)
              const guestId = e.dataTransfer.getData('application/x-guest-id')
              if (guestId) assignGuestsToTable([guestId], table.id)
            }}
          >
            <div className="table-board-card-header">
              <span className="table-board-dot" style={{ background: table.color }} />
              <strong className="truncate">{table.name}</strong>
              <span className={`chip ${full ? 'chip-warning' : 'chip-neutral'}`}>{occupants.length}/{table.capacity}</span>
            </div>
            <div className="table-board-card-body">
              {occupants.length === 0 && <p className="text-muted text-sm">Arrastra invitados aquí</p>}
              {occupants.map((g) => (
                <div key={g.id} className="table-board-guest">
                  <span className="truncate">{g.fullName}</span>
                  <button className="btn-icon btn-ghost btn-sm" onClick={() => unassignGuest(g.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
