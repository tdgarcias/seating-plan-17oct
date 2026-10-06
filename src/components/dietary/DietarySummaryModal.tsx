import Modal from '@/components/common/Modal'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import { dietaryAbbrs, formatDietary, hasDietary, isSevere, summarizeDietary } from '@/utils/dietary'

/** Resumen de alergias y dietas: totales y desglose por mesa del escenario activo. */
export default function DietarySummaryModal({ onClose }: { onClose: () => void }) {
  const guests = useProjectStore((s) => s.project.guests)
  const scenario = useActiveScenario()
  const withDiet = guests.filter((g) => g.status !== 'rechazado' && hasDietary(g.dietary))
  const totals = summarizeDietary(withDiet)
  const unassigned = withDiet.filter((g) => !g.tableId)

  return (
    <Modal onClose={onClose} width={640}>
      <h2>Alergias y dietas</h2>
      <p className="text-soft text-sm" style={{ marginTop: 4 }}>
        {withDiet.length} invitado(s) con restricciones (sin contar rechazados) · escenario "{scenario.name}"
      </p>

      {withDiet.length === 0 ? (
        <p className="text-muted text-sm" style={{ marginTop: 16 }}>
          Nadie tiene alergias registradas todavía. Ábrelas desde la ficha de cada invitado (ⓘ).
        </p>
      ) : (
        <>
          <div className="dietary-totals">
            {totals.map((t) => (
              <span key={t.abbr} className="chip chip-neutral">{t.label} <strong>{t.count}</strong></span>
            ))}
          </div>

          <div className="dietary-table-list scroll-y">
            {scenario.tables.map((table) => {
              const list = withDiet
                .filter((g) => g.tableId === table.id)
                .sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999))
              if (!list.length) return null
              return (
                <div key={table.id} className="dietary-table-block">
                  <h4>{table.name} <span className="text-muted text-sm">· {list.length}</span></h4>
                  {list.map((g) => (
                    <div key={g.id} className={`dietary-row ${isSevere(g.dietary) ? 'is-severe' : ''}`}>
                      <span className="dietary-row-seat">{g.seatIndex !== null ? g.seatIndex + 1 : '—'}</span>
                      <span className="dietary-row-name">{g.fullName}</span>
                      <span className="dietary-row-tags">{dietaryAbbrs(g.dietary).join(' · ') || 'Nota'}</span>
                      <span className="dietary-row-detail text-muted text-sm">{formatDietary(g.dietary)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
            {unassigned.length > 0 && (
              <div className="dietary-table-block">
                <h4>Sin mesa <span className="text-muted text-sm">· {unassigned.length}</span></h4>
                {unassigned.map((g) => (
                  <div key={g.id} className={`dietary-row ${isSevere(g.dietary) ? 'is-severe' : ''}`}>
                    <span className="dietary-row-seat">—</span>
                    <span className="dietary-row-name">{g.fullName}</span>
                    <span className="dietary-row-tags">{dietaryAbbrs(g.dietary).join(' · ') || 'Nota'}</span>
                    <span className="dietary-row-detail text-muted text-sm">{formatDietary(g.dietary)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
