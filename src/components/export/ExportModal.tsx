import { useRef, useState } from 'react'
import Modal from '@/components/common/Modal'
import RoomCanvas from '@/components/room/RoomCanvas'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import { exportSvgToPng, exportSvgToPdf, PNG_RESOLUTIONS, type PngResolutionKey } from '@/services/exportService'

interface ExportModalProps {
  onClose: () => void
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const scenario = useActiveScenario()
  const pushToast = useProjectStore((s) => s.pushToast)
  const [fullNames, setFullNames] = useState(scenario.room.showFullSeatNames)
  const [resolution, setResolution] = useState<PngResolutionKey>('alta')
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const filenameBase = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'seating-plan'

  const handleExportPng = async () => {
    if (!svgRef.current) return
    setBusy('png')
    try {
      await exportSvgToPng(svgRef.current, `${filenameBase}.png`, resolution)
      pushToast('success', 'Imagen exportada')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se ha podido exportar la imagen.')
    } finally {
      setBusy(null)
    }
  }

  const handleExportPdf = async () => {
    if (!svgRef.current) return
    setBusy('pdf')
    try {
      await exportSvgToPdf(svgRef.current, `${filenameBase}.pdf`)
      pushToast('success', 'PDF exportado')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se ha podido exportar el PDF.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} width={760}>
      <h2>Exportar plano</h2>
      <p className="text-soft text-sm" style={{ marginTop: 4 }}>
        Genera una imagen o un PDF del escenario "{scenario.name}" listo para compartir con tu wedding planner.
      </p>

      <div className="export-modal-grid">
        <div className="export-preview">
          <RoomCanvas interactive={false} svgRef={svgRef} forceFullNames={fullNames} />
        </div>

        <div className="flex-col gap-3">
          <label className="checkbox-row">
            <input type="checkbox" checked={fullNames} onChange={(e) => setFullNames(e.target.checked)} />
            Mostrar nombre completo del invitado (en vez de iniciales)
          </label>

          <div className="field">
            <label>Resolución de la imagen (PNG)</label>
            <select className="select" value={resolution} onChange={(e) => setResolution(e.target.value as PngResolutionKey)}>
              {Object.entries(PNG_RESOLUTIONS).map(([key, r]) => (
                <option key={key} value={key}>{r.label} · {r.widthPx}px de ancho</option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" onClick={handleExportPng} disabled={busy !== null}>
            {busy === 'png' ? 'Generando imagen…' : '⬇ Descargar PNG'}
          </button>
          <button className="btn btn-secondary" onClick={handleExportPdf} disabled={busy !== null}>
            {busy === 'pdf' ? 'Generando PDF…' : '⬇ Descargar PDF (vectorial)'}
          </button>
          <p className="text-muted text-sm">
            El PDF es vectorial: el texto se mantiene nítido a cualquier zoom o tamaño de impresión.
          </p>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
