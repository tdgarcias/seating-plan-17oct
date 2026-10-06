import { useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ScenarioCompareModal from './ScenarioCompareModal'
import type { Scenario } from '@/types'

function formatUpdated(ts: number): string {
  const d = new Date(ts)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? `hoy ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function seatedCount(s: Scenario): number {
  return Object.keys(s.assignments ?? {}).length
}

export default function ScenarioBar() {
  const project = useProjectStore((s) => s.project)
  const setActiveScenario = useProjectStore((s) => s.setActiveScenario)
  const createScenario = useProjectStore((s) => s.createScenario)
  const duplicateScenario = useProjectStore((s) => s.duplicateScenario)
  const renameScenario = useProjectStore((s) => s.renameScenario)
  const deleteScenario = useProjectStore((s) => s.deleteScenario)

  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState<string>('')
  const [compareOpen, setCompareOpen] = useState(false)

  const active = project.scenarios.find((s) => s.id === project.activeScenarioId) ?? project.scenarios[0]
  const pendingScenario = project.scenarios.find((s) => s.id === pendingDelete)

  const startCreate = () => {
    setCreating(true)
    setNewName(`Propuesta ${project.scenarios.length + 1}`)
    setNewSource(active.id)
  }

  const confirmCreate = () => {
    if (!newName.trim()) return
    createScenario(newName.trim(), newSource || null)
    setCreating(false)
    setOpen(false)
  }

  return (
    <div className="scenario-bar">
      <button className="scenario-current" onClick={() => setOpen((v) => !v)} title="Cambiar, crear o comparar escenarios">
        <span className="scenario-current-top text-muted">
          <span>ESCENARIO</span>
          <span className="scenario-current-meta">· {seatedCount(active)} sentados · {formatUpdated(active.updatedAt)}</span>
        </span>
        <span className="scenario-current-name">
          <strong>{active.name}</strong>
          <span aria-hidden>▾</span>
        </span>
      </button>

      {open && (
        <div className="dropdown-menu scenario-menu">
          <div className="scenario-menu-head">
            <span className="text-muted text-sm">{project.scenarios.length} escenario(s) · cada uno guarda su propio reparto</span>
            <button className="btn-icon btn-ghost btn-sm" title="Cerrar" onClick={() => setOpen(false)}>✕</button>
          </div>

          {project.scenarios.map((s) => (
            <div key={s.id} className={`scenario-row ${s.id === active.id ? 'is-active' : ''}`}>
              {renamingId === s.id ? (
                <input
                  className="input"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameScenario(s.id, nameDraft.trim() || s.name)
                      setRenamingId(null)
                    }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onBlur={() => {
                    renameScenario(s.id, nameDraft.trim() || s.name)
                    setRenamingId(null)
                  }}
                />
              ) : (
                <button className="scenario-row-name" onClick={() => { setActiveScenario(s.id); setOpen(false) }}>
                  <span>{s.id === active.id ? '● ' : ''}{s.name}</span>
                  <span className="text-muted text-sm">
                    {s.tables.length} mesas · {seatedCount(s)} sentados · {formatUpdated(s.updatedAt)}
                  </span>
                </button>
              )}
              <div className="scenario-row-actions">
                <button className="btn-icon btn-ghost btn-sm" title="Renombrar" onClick={() => { setRenamingId(s.id); setNameDraft(s.name) }}>✎</button>
                <button className="btn-icon btn-ghost btn-sm" title="Duplicar (copia independiente)" onClick={() => { duplicateScenario(s.id); setOpen(false) }}>⧉</button>
                <button
                  className="btn-icon btn-ghost btn-sm"
                  title={project.scenarios.length <= 1 ? 'Debe existir al menos un escenario' : 'Eliminar'}
                  disabled={project.scenarios.length <= 1}
                  onClick={() => setPendingDelete(s.id)}
                >✕</button>
              </div>
            </div>
          ))}

          <hr className="divider" />

          {creating ? (
            <div className="scenario-create flex-col gap-2">
              <input
                className="input"
                autoFocus
                placeholder="Nombre del escenario"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
              />
              <select className="select" value={newSource} onChange={(e) => setNewSource(e.target.value)}>
                <option value="">Vacío (sin mesas ni invitados sentados)</option>
                {project.scenarios.map((s) => (
                  <option key={s.id} value={s.id}>Duplicar desde «{s.name}»</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={confirmCreate} disabled={!newName.trim()}>Crear</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button className="scenario-add" onClick={startCreate}>+ Nuevo escenario</button>
              {project.scenarios.length > 1 && (
                <button className="scenario-add" onClick={() => { setCompareOpen(true); setOpen(false) }}>⇄ Comparar</button>
              )}
            </div>
          )}
        </div>
      )}

      {pendingDelete && pendingScenario && (
        <ConfirmDialog
          title="Eliminar escenario"
          description={`Se eliminará «${pendingScenario.name}» con sus mesas y su reparto. Los demás escenarios no se modifican. Se puede deshacer con Ctrl+Z.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { deleteScenario(pendingDelete); setPendingDelete(null) }}
        />
      )}

      {compareOpen && <ScenarioCompareModal onClose={() => setCompareOpen(false)} />}
    </div>
  )
}
