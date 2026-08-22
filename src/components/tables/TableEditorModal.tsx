import { useState } from 'react'
import Modal from '@/components/common/Modal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import NumberField from '@/components/common/NumberField'
import { useProjectStore, useActiveScenario, nextPaletteColor } from '@/store/useProjectStore'
import { computeSeatPositions, defaultSeatsPerSide } from '@/utils/geometry'
import type { TableType } from '@/types'
import type { SeatsPerSide } from '@/types'

const PALETTE = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => nextPaletteColor(i))

interface TableEditorModalProps {
  tableId: string
  onClose: () => void
}

export default function TableEditorModal({ tableId, onClose }: TableEditorModalProps) {
  const scenario = useActiveScenario()
  const guests = useProjectStore((s) => s.project.guests)
  const updateTable = useProjectStore((s) => s.updateTable)
  const duplicateTable = useProjectStore((s) => s.duplicateTable)
  const deleteTable = useProjectStore((s) => s.deleteTable)
  const assignGuestToSeat = useProjectStore((s) => s.assignGuestToSeat)
  const unassignGuest = useProjectStore((s) => s.unassignGuest)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragOverSeat, setDragOverSeat] = useState<number | null>(null)

  const table = scenario.tables.find((t) => t.id === tableId)
  if (!table) return null

  const seats = computeSeatPositions(table, guests)
  const unassigned = guests.filter((g) => !g.tableId)

  const setType = (type: TableType) => {
    updateTable(table.id, {
      type,
      diameter: type === 'round' ? table.diameter ?? 1.5 : undefined,
      width: type === 'rect' ? table.width ?? 1.8 : undefined,
      length: type === 'rect' ? table.length ?? 0.9 : undefined,
      seatsPerSide: type === 'rect' ? defaultSeatsPerSide(table.capacity) : undefined
    })
  }

  return (
    <>
      <Modal onClose={onClose} width={760}>
        <div className="flex justify-between items-center">
          <h2 className="truncate">{table.name}</h2>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => duplicateTable(table.id)}>⧉ Duplicar</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>Eliminar</button>
          </div>
        </div>

        <div className="table-editor-grid">
          <div className="flex-col gap-3">
            <div className="field">
              <label>Nombre de la mesa</label>
              <input className="input" value={table.name} onChange={(e) => updateTable(table.id, { name: e.target.value })} />
            </div>

            <div className="field">
              <label>Tipo</label>
              <div className="segmented">
                <button className={table.type === 'round' ? 'is-active' : ''} onClick={() => setType('round')}>Redonda</button>
                <button className={table.type === 'rect' ? 'is-active' : ''} onClick={() => setType('rect')}>Rectangular</button>
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label>Comensales</label>
                <NumberField
                  value={table.capacity} min={1} max={10000}
                  onCommit={(v) => updateTable(table.id, { capacity: Math.max(1, Math.round(v)) })}
                />
              </div>
              <div className="field">
                <label>Rotación (°)</label>
                <NumberField
                  value={table.rotation} min={0} max={359}
                  onCommit={(v) => updateTable(table.id, { rotation: Math.round(v) })}
                />
              </div>
            </div>

            {table.type === 'round' ? (
              <div className="field">
                <label>Diámetro (m)</label>
                <NumberField
                  value={table.diameter ?? 1.5} min={0.4} step={0.1}
                  onCommit={(v) => updateTable(table.id, { diameter: v })}
                />
              </div>
            ) : (
              <div className="field-grid">
                <div className="field">
                  <label>Anchura (m)</label>
                  <NumberField value={table.width ?? 1.8} min={0.4} step={0.1} onCommit={(v) => updateTable(table.id, { width: v })} />
                </div>
                <div className="field">
                  <label>Longitud (m)</label>
                  <NumberField value={table.length ?? 0.9} min={0.4} step={0.1} onCommit={(v) => updateTable(table.id, { length: v })} />
                </div>
              </div>
            )}

            <div className="field">
              <label>Color</label>
              <div className="color-swatches">
                {PALETTE.map((c) => (
                  <button
                    key={c} className={`color-swatch ${table.color === c ? 'is-selected' : ''}`}
                    style={{ background: c }} onClick={() => updateTable(table.id, { color: c })}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={!!table.locked} onChange={(e) => updateTable(table.id, { locked: e.target.checked })} />
              Bloquear posición
            </label>
          </div>

          <div className="table-editor-seats">
            <h4 className="text-sm text-soft" style={{ marginBottom: 4 }}>
              Vista cenital · asientos ({seats.filter((s) => s.guest).length}/{table.capacity})
            </h4>
            <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
              Arrastra un invitado de una fila a otra para intercambiarlos de asiento.
            </p>
            <div className="scroll-y seat-list">
              {seats.map((seat) => (
                <div
                  key={seat.index}
                  className={`seat-row ${dragOverSeat === seat.index ? 'is-drag-over' : ''}`}
                  draggable={!!seat.guest}
                  onDragStart={(e) => {
                    if (!seat.guest) return
                    e.dataTransfer.setData('application/x-guest-id', seat.guest.id)
                    e.dataTransfer.setData('application/x-seat-swap', String(seat.index))
                  }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('application/x-guest-id')) {
                      e.preventDefault()
                      setDragOverSeat(seat.index)
                    }
                  }}
                  onDragLeave={() => setDragOverSeat((s) => (s === seat.index ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverSeat(null)
                    const guestId = e.dataTransfer.getData('application/x-guest-id')
                    if (guestId) assignGuestToSeat(guestId, table.id, seat.index)
                  }}
                >
                  <span className="text-sm text-muted">#{seat.index + 1}</span>
                  {seat.guest ? (
                    <>
                      <span className={`truncate ${seat.guest.isCouple ? 'is-couple-text' : ''}`}>{seat.guest.fullName}</span>
                      <button className="btn-icon btn-ghost btn-sm" onClick={() => unassignGuest(seat.guest!.id)}>✕</button>
                    </>
                  ) : (
                    <select
                      className="select"
                      value=""
                      onChange={(e) => e.target.value && assignGuestToSeat(e.target.value, table.id, seat.index)}
                    >
                      <option value="">Asiento libre — asignar…</option>
                      {unassigned.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar mesa"
          description={`Se eliminará "${table.name}" y los invitados asignados quedarán sin mesa. Puedes deshacerlo con Ctrl+Z.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { deleteTable(table.id); setConfirmDelete(false); onClose() }}
        />
      )}
    </>
  )
}
