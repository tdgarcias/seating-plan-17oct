import { useMemo, useState } from 'react'
import Modal from '@/components/common/Modal'
import { useProjectStore } from '@/store/useProjectStore'

/** Compara dos escenarios y lista los invitados que cambian de mesa o de asiento. */
export default function ScenarioCompareModal({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const scenarios = project.scenarios
  const [aId, setAId] = useState(scenarios[0]?.id ?? '')
  const [bId, setBId] = useState(scenarios[1]?.id ?? scenarios[0]?.id ?? '')
  const [onlyTableChanges, setOnlyTableChanges] = useState(true)

  const rows = useMemo(() => {
    const a = scenarios.find((s) => s.id === aId)
    const b = scenarios.find((s) => s.id === bId)
    if (!a || !b) return []
    const tableNameA = new Map(a.tables.map((t) => [t.id, t.name]))
    const tableNameB = new Map(b.tables.map((t) => [t.id, t.name]))
    const describe = (names: Map<string, string>, as?: { tableId: string; seatIndex: number | null }) =>
      as ? `${names.get(as.tableId) ?? '¿mesa?'}${as.seatIndex !== null ? ` · ${as.seatIndex + 1}` : ''}` : 'Sin mesa'
    return project.guests
      .map((g) => {
        const sa = a.assignments[g.id]
        const sb = b.assignments[g.id]
        const tableChanged = (sa?.tableId ?? null) !== (sb?.tableId ?? null)
        const seatChanged = (sa?.seatIndex ?? null) !== (sb?.seatIndex ?? null)
        return { guest: g, from: describe(tableNameA, sa), to: describe(tableNameB, sb), tableChanged, seatChanged }
      })
      .filter((r) => (onlyTableChanges ? r.tableChanged : r.tableChanged || r.seatChanged))
      .sort((x, y) => x.guest.fullName.localeCompare(y.guest.fullName, 'es'))
  }, [aId, bId, onlyTableChanges, project.guests, scenarios])

  const nameOf = (id: string) => scenarios.find((s) => s.id === id)?.name ?? ''

  return (
    <Modal onClose={onClose} width={680}>
      <h2>Comparar escenarios</h2>
      <div className="input-row" style={{ marginTop: 12 }}>
        <select className="select" value={aId} onChange={(e) => setAId(e.target.value)}>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select" value={bId} onChange={(e) => setBId(e.target.value)}>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <label className="checkbox-row" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={!onlyTableChanges} onChange={(e) => setOnlyTableChanges(!e.target.checked)} />
        Incluir también cambios de asiento dentro de la misma mesa
      </label>

      <p className="text-soft text-sm" style={{ marginTop: 10 }}>
        {aId === bId ? 'Elige dos escenarios distintos.' : `${rows.length} invitado(s) con cambios`}
      </p>

      {aId !== bId && rows.length > 0 && (
        <div className="compare-table scroll-y">
          <div className="compare-row compare-head">
            <span>Invitado</span><span>{nameOf(aId)}</span><span>{nameOf(bId)}</span>
          </div>
          {rows.map((r) => (
            <div key={r.guest.id} className="compare-row">
              <span className="truncate">{r.guest.fullName}</span>
              <span className="text-soft">{r.from}</span>
              <span className={r.tableChanged ? 'compare-changed' : 'text-soft'}>{r.to}</span>
            </div>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
