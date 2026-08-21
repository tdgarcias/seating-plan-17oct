import { useMemo, useState } from 'react'
import Modal from '@/components/common/Modal'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import { SUGGESTED_ROLES, type ConfirmationStatus } from '@/types'

interface GuestDetailModalProps {
  guestId: string
  onClose: () => void
}

export default function GuestDetailModal({ guestId, onClose }: GuestDetailModalProps) {
  const guest = useProjectStore((s) => s.project.guests.find((g) => g.id === guestId))
  const allGuests = useProjectStore((s) => s.project.guests)
  const incompatibilities = useProjectStore((s) => s.project.incompatibilities)
  const updateGuest = useProjectStore((s) => s.updateGuest)
  const unassignGuest = useProjectStore((s) => s.unassignGuest)
  const addIncompatibility = useProjectStore((s) => s.addIncompatibility)
  const removeIncompatibility = useProjectStore((s) => s.removeIncompatibility)
  const scenario = useActiveScenario()
  const [draft, setDraft] = useState(guest)
  const [incompatTarget, setIncompatTarget] = useState('')

  const myIncompatibilities = useMemo(
    () => incompatibilities.filter((i) => guest && (i.guestAId === guest.id || i.guestBId === guest.id)),
    [incompatibilities, guest]
  )

  if (!guest || !draft) return null

  const table = scenario.tables.find((t) => t.id === guest.tableId)
  const guestById = new Map(allGuests.map((g) => [g.id, g]))
  const otherGuests = allGuests.filter((g) => g.id !== guest.id && !myIncompatibilities.some((i) => i.guestAId === g.id || i.guestBId === g.id))

  const save = () => {
    updateGuest(guest.id, {
      notes: draft.notes,
      dietary: draft.dietary,
      companions: draft.companions,
      group: draft.group,
      status: draft.status,
      role: draft.role,
      isCouple: draft.isCouple
    })
    onClose()
  }

  return (
    <Modal onClose={onClose} width={480}>
      <h2 className={guest.isCouple ? 'is-couple-text' : ''}>{guest.isCouple && '♥ '}{guest.fullName}</h2>
      <p className="text-soft text-sm" style={{ marginTop: 2 }}>
        {table ? `${table.name} · asiento ${guest.seatIndex !== null ? guest.seatIndex + 1 : '—'}` : 'Sin mesa asignada'}
      </p>

      <div className="flex-col gap-3" style={{ marginTop: 16 }}>
        <div className="field-grid">
          <div className="field">
            <label>Grupo</label>
            <input className="input" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} />
          </div>
          <div className="field">
            <label>Acompañantes</label>
            <input
              type="number" min={0} className="input" value={draft.companions}
              onChange={(e) => setDraft({ ...draft, companions: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label>Rol</label>
            <input
              className="input" list="role-suggestions" value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              placeholder="Familiar, amigo/a..."
            />
            <datalist id="role-suggestions">
              {SUGGESTED_ROLES.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Estado</label>
            <select
              className="select"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as ConfirmationStatus })}
            >
              <option value="confirmado">Confirmado</option>
              <option value="pendiente">Pendiente</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={draft.isCouple} onChange={(e) => setDraft({ ...draft, isCouple: e.target.checked })} />
          Es uno de los novios (se resaltará en rojo en el plano)
        </label>

        <div className="field">
          <label>Restricciones alimentarias</label>
          <input className="input" value={draft.dietary} onChange={(e) => setDraft({ ...draft, dietary: e.target.value })} />
        </div>

        <div className="field">
          <label>Notas</label>
          <textarea
            className="input" rows={3} value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Incompatibilidades — no sentar con</label>
          {myIncompatibilities.length === 0 && (
            <p className="text-muted text-sm">Sin incompatibilidades marcadas.</p>
          )}
          <div className="flex-col gap-1">
            {myIncompatibilities.map((inc) => {
              const otherId = inc.guestAId === guest.id ? inc.guestBId : inc.guestAId
              const other = guestById.get(otherId)
              return (
                <div key={inc.id} className="incompat-row">
                  <span className="truncate">{other?.fullName ?? 'Invitado eliminado'}</span>
                  <button className="btn-icon btn-ghost btn-sm" onClick={() => removeIncompatibility(inc.id)}>✕</button>
                </div>
              )
            })}
          </div>
          <div className="input-row" style={{ marginTop: 6 }}>
            <select className="select" value={incompatTarget} onChange={(e) => setIncompatTarget(e.target.value)}>
              <option value="">Añadir invitado incompatible…</option>
              {otherGuests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
            </select>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!incompatTarget}
              onClick={() => { addIncompatibility(guest.id, incompatTarget); setIncompatTarget('') }}
            >
              Añadir
            </button>
          </div>
        </div>
      </div>

      <div className="modal-actions">
        {guest.tableId && (
          <button className="btn btn-danger" onClick={() => { unassignGuest(guest.id); onClose() }}>
            Quitar de la mesa
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save}>Guardar</button>
      </div>
    </Modal>
  )
}
