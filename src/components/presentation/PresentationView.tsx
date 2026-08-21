import { useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import RoomCanvas from '@/components/room/RoomCanvas'
import ExportModal from '@/components/export/ExportModal'

export default function PresentationView() {
  const project = useProjectStore((s) => s.project)
  const scenario = useActiveScenario()
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <div className="presentation-view">
      <div className="presentation-header">
        <h2>{project.settings.coupleNames}</h2>
        <p className="text-soft">{scenario.name}{project.settings.weddingDate ? ` · ${project.settings.weddingDate}` : ''}</p>
        <button className="btn btn-secondary btn-sm presentation-export" onClick={() => setExportOpen(true)}>
          Exportar imagen / PDF
        </button>
      </div>
      <div className="presentation-canvas">
        <RoomCanvas interactive={false} />
      </div>
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
    </div>
  )
}
