import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/common/Modal'
import { useProjectStore } from '@/store/useProjectStore'
import { guestsForScenario } from '@/store/scenarioAssignments'
import { hasDietary } from '@/utils/dietary'
import type { PrintOptions, PrintReport } from '@/services/printA4Service'

interface PrintA4ModalProps {
  onClose: () => void
}

function formatWeddingDate(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Exportación A4 para wedding planner y camareros, con vista previa real del PDF. */
export default function PrintA4Modal({ onClose }: PrintA4ModalProps) {
  const project = useProjectStore((s) => s.project)
  const pushToast = useProjectStore((s) => s.pushToast)
  const [scenarioId, setScenarioId] = useState(project.activeScenarioId)
  const [opts, setOpts] = useState<Omit<PrintOptions, 'title' | 'subtitle'>>({
    orientation: 'auto',
    showDietary: true,
    includeLegend: true,
    seatNumbers: true,
    tableDetail: 'auto',
    cateringSheet: true,
    unassignedList: false
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [report, setReport] = useState<PrintReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  const scenario = project.scenarios.find((s) => s.id === scenarioId) ?? project.scenarios[0]
  const guests = useMemo(() => guestsForScenario(project, scenario.id), [project, scenario.id])
  const dietaryCount = guests.filter((g) => g.status !== 'rechazado' && hasDietary(g.dietary)).length
  const filenameBase = `${project.settings.coupleNames || 'seating'}-${scenario.name}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const timer = setTimeout(async () => {
      try {
        const { buildSeatingPdf } = await import('@/services/printA4Service')
        const subtitle = [
          formatWeddingDate(project.settings.weddingDate),
          `${guests.filter((g) => g.tableId).length} invitados sentados`,
          `${scenario.tables.length} mesas`
        ].filter(Boolean).join(' · ')
        const { pdf, report } = buildSeatingPdf(
          { scenario, guests },
          { ...opts, title: project.settings.coupleNames || 'Seating plan', subtitle }
        )
        if (cancelled) return
        const blob = pdf.output('blob')
        blobRef.current = blob
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        setReport(report)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se ha podido generar el PDF.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [opts, scenario, guests, project.settings.coupleNames, project.settings.weddingDate])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const download = () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filenameBase}-A4.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    pushToast('success', 'PDF A4 descargado')
  }

  const openToPrint = () => {
    if (previewUrl) window.open(previewUrl, '_blank', 'noopener')
  }

  const set = <K extends keyof typeof opts>(key: K, value: (typeof opts)[K]) => setOpts((o) => ({ ...o, [key]: value }))

  return (
    <Modal onClose={onClose} width={1100}>
      <h2>Imprimir A4 · wedding planner y catering</h2>
      <p className="text-soft text-sm" style={{ marginTop: 4 }}>
        PDF vectorial en A4 con el nombre completo de cada invitado. Las alergias se marcan con texto y "(!)", así que se leen igual en blanco y negro.
      </p>

      <div className="print-modal-grid">
        <div className="print-options flex-col gap-3">
          <div className="field">
            <label>Escenario</label>
            <select className="select" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              {project.scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.id === project.activeScenarioId ? ' (activo)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Orientación</label>
            <div className="segmented">
              {(['auto', 'portrait', 'landscape'] as const).map((o) => (
                <button key={o} className={opts.orientation === o ? 'is-active' : ''} onClick={() => set('orientation', o)}>
                  {o === 'auto' ? 'Automática' : o === 'portrait' ? 'Vertical' : 'Horizontal'}
                </button>
              ))}
            </div>
          </div>

          <div className="print-checks">
            <label className="checkbox-row">
              <input type="checkbox" checked={opts.showDietary} onChange={(e) => set('showDietary', e.target.checked)} />
              <span>Mostrar alergias e intolerancias junto al nombre <span className="text-muted">({dietaryCount})</span></span>
            </label>
            <label className={`checkbox-row ${!opts.showDietary ? 'is-disabled' : ''}`}>
              <input type="checkbox" disabled={!opts.showDietary} checked={opts.includeLegend} onChange={(e) => set('includeLegend', e.target.checked)} />
              Incluir leyenda de abreviaturas
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={opts.seatNumbers} onChange={(e) => set('seatNumbers', e.target.checked)} />
              Números de asiento
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={opts.cateringSheet} onChange={(e) => set('cateringSheet', e.target.checked)} />
              Hoja de catering (tabla por mesa para camareros)
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={opts.unassignedList} onChange={(e) => set('unassignedList', e.target.checked)} />
              Lista de invitados sin mesa
            </label>
          </div>

          <div className="field">
            <label>Páginas por mesa (nombres en grande)</label>
            <select className="select" value={opts.tableDetail} onChange={(e) => set('tableDetail', e.target.value as PrintOptions['tableDetail'])}>
              <option value="auto">Automático: solo si no caben en el plano general</option>
              <option value="always">Siempre (una página por mesa)</option>
              <option value="never">Nunca</option>
            </select>
          </div>

          {report && (
            <div className="print-report text-sm">
              <strong>{report.pages} página(s)</strong>
              <span>
                {report.overviewShowsNames
                  ? `Plano general con nombres a ${report.overviewFontPt} pt.`
                  : 'Plano general con números de asiento (los nombres no caben legibles en una sola hoja).'}
              </span>
              {report.detailTables > 0 && <span>{report.detailTables} mesa(s) en página propia con nombre completo.</span>}
              {report.splitTables.length > 0 && <span>Repartidas en varias páginas: {report.splitTables.join(', ')}.</span>}
              {report.warnings.map((w) => <span key={w} className="print-warning">⚠ {w}</span>)}
            </div>
          )}
          {error && <p className="print-warning text-sm">⚠ {error}</p>}

          <div className="flex-col gap-2">
            <button className="btn btn-primary" onClick={download} disabled={busy || !previewUrl}>
              {busy ? 'Generando…' : '⬇ Descargar PDF A4'}
            </button>
            <button className="btn btn-secondary" onClick={openToPrint} disabled={busy || !previewUrl}>
              🖨 Abrir para imprimir
            </button>
          </div>
        </div>

        <div className="print-preview">
          {previewUrl ? (
            <iframe title="Vista previa A4" src={`${previewUrl}#view=FitH`} />
          ) : (
            <div className="print-preview-empty text-muted">Generando vista previa…</div>
          )}
          {busy && previewUrl && <div className="print-preview-busy">Actualizando…</div>}
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
