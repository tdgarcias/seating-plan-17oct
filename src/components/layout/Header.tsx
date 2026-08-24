import { useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import type { ViewMode } from '@/types'
import ScenarioBar from '@/components/scenarios/ScenarioBar'
import { downloadProjectFile, readProjectFile } from '@/services/storageService'
import { exportGuestsCsv, exportScenarioJson, printSeatingPlan } from '@/services/exportService'
import ExportModal from '@/components/export/ExportModal'

const TABS: { id: ViewMode; label: string }[] = [
  { id: 'mapa', label: 'Mapa' },
  { id: 'organizar', label: 'Organizar invitados' },
  { id: 'presentacion', label: 'Presentación' }
]

export default function Header() {
  const project = useProjectStore((s) => s.project)
  const viewMode = useProjectStore((s) => s.ui.viewMode)
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s.history.canUndo())
  const canRedo = useProjectStore((s) => s.history.canRedo())
  const replaceProject = useProjectStore((s) => s.replaceProject)
  const pushToast = useProjectStore((s) => s.pushToast)
  const updateRoomSettings = useProjectStore((s) => s.updateRoomSettings)
  const scenario = useActiveScenario()
  const [exportOpen, setExportOpen] = useState(false)
  const [imageExportOpen, setImageExportOpen] = useState(false)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    readProjectFile(file)
      .then((p) => {
        replaceProject(p)
        pushToast('success', 'Proyecto importado correctamente')
      })
      .catch((err) => pushToast('error', err.message))
    e.target.value = ''
  }

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <span className="app-header-mark" aria-hidden>⚘</span>
        <div className="app-header-title">
          <h1>Seating Plan</h1>
          <span className="text-muted text-sm">{project.settings.coupleNames}</span>
        </div>
      </div>

      <ScenarioBar />

      <nav className="app-header-tabs" aria-label="Modo de vista">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`app-header-tab ${viewMode === tab.id ? 'is-active' : ''}`}
            onClick={() => setViewMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="app-header-actions">
        <button className="btn btn-icon btn-ghost" title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>↺</button>
        <button className="btn btn-icon btn-ghost" title="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>↻</button>

        <button
          className={`btn btn-secondary btn-sm ${scenario.room.showFullSeatNames ? 'is-active' : ''}`}
          title="Mostrar el nombre completo de cada invitado junto a su silla"
          onClick={() => updateRoomSettings({ showFullSeatNames: !scenario.room.showFullSeatNames })}
        >
          🔤 {scenario.room.showFullSeatNames ? 'Nombres completos' : 'Solo iniciales'}
        </button>

        <div className="app-header-export">
          <button className="btn btn-secondary btn-sm" onClick={() => setExportOpen((v) => !v)}>
            Exportar ▾
          </button>
          {exportOpen && (
            <div className="dropdown-menu" onMouseLeave={() => setExportOpen(false)}>
              <button onClick={() => { setImageExportOpen(true); setExportOpen(false) }}>
                Imagen / PDF del plano…
              </button>
              <button onClick={() => { exportGuestsCsv(project.guests, scenario.tables); setExportOpen(false) }}>
                Invitados (CSV)
              </button>
              <button onClick={() => { exportScenarioJson(scenario, project.guests); setExportOpen(false) }}>
                Escenario (JSON)
              </button>
              <button onClick={() => { printSeatingPlan(); setExportOpen(false) }}>
                Imprimir plano
              </button>
              <hr className="divider" />
              <button onClick={() => { downloadProjectFile(project); setExportOpen(false) }}>
                Proyecto completo (.json)
              </button>
              <label className="dropdown-file-label">
                Importar proyecto…
                <input type="file" accept="application/json" onChange={handleImport} hidden />
              </label>
            </div>
          )}
        </div>

        <span className="chip chip-success" title="Guardado automático activo">● Guardado</span>
      </div>

      {imageExportOpen && <ExportModal onClose={() => setImageExportOpen(false)} />}
    </header>
  )
}
