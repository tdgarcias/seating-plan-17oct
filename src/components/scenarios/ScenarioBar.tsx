import { useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import ConfirmDialog from '@/components/common/ConfirmDialog'

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

  const active = project.scenarios.find((s) => s.id === project.activeScenarioId) ?? project.scenarios[0]

  return (
    <div className="scenario-bar">
      <button className="scenario-current" onClick={() => setOpen((v) => !v)}>
        <span className="text-muted text-sm">ESCENARIO</span>
        <strong>{active.name}</strong>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="dropdown-menu scenario-menu" onMouseLeave={() => setOpen(false)}>
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
                  {s.name}
                  <span className="text-muted text-sm"> · {s.tables.length} mesas</span>
                </button>
              )}
              <div className="scenario-row-actions">
                <button className="btn-icon btn-ghost btn-sm" title="Renombrar" onClick={() => { setRenamingId(s.id); setNameDraft(s.name) }}>✎</button>
                <button className="btn-icon btn-ghost btn-sm" title="Duplicar" onClick={() => duplicateScenario(s.id)}>⧉</button>
                <button className="btn-icon btn-ghost btn-sm" title="Eliminar" onClick={() => setPendingDelete(s.id)}>✕</button>
              </div>
            </div>
          ))}

          <hr className="divider" />

          {creating ? (
            <div className="scenario-row">
              <input
                className="input"
                autoFocus
                placeholder="Nombre del escenario"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    createScenario(newName.trim())
                    setNewName('')
                    setCreating(false)
                    setOpen(false)
                  }
                  if (e.key === 'Escape') setCreating(false)
                }}
              />
            </div>
          ) : (
            <button className="scenario-add" onClick={() => setCreating(true)}>
              + Nuevo escenario
            </button>
          )}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar escenario"
          description="Se eliminará este escenario y las mesas que contiene. Los invitados asignados solo en él quedarán sin mesa. Esta acción se puede deshacer con Ctrl+Z."
          confirmLabel="Eliminar"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { deleteScenario(pendingDelete); setPendingDelete(null) }}
        />
      )}
    </div>
  )
}
