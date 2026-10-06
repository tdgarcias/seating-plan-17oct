import { useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import RoomCanvas from '@/components/room/RoomCanvas'
import ExportModal from '@/components/export/ExportModal'
import PrintA4Modal from '@/components/export/PrintA4Modal'

export default function PresentationView() {
  const project = useProjectStore((s) => s.project)
  const scenario = useActiveScenario()
  const [exportOpen, setExportOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  return (
    <div className="presentation-view">
      <div className="presentation-header">
        <h2>{project.settings.coupleNames}</h2>
        <p className="text-soft">{scenario.name}{project.settings.weddingDate ? ` · ${project.settings.weddingDate}` : ''}</p>
        <div className="presentation-export flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setExportOpen(true)}>
            Exportar imagen / PDF
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setPrintOpen(true)}>
            🖨 Imprimir A4
          </button>
        </div>
      </div>
      <div className="presentation-canvas">
        <RoomCanvas interactive={false} />
      </div>
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      {printOpen && <PrintA4Modal onClose={() => setPrintOpen(false)} />}
    </div>
  )
}
