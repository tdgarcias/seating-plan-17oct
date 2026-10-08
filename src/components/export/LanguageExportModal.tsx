import { useEffect, useState } from 'react'
import Modal from '@/components/common/Modal'
import { useProjectStore } from '@/store/useProjectStore'
import { buildLanguageColumn, exportLanguageCsv, type LanguageColumnResult } from '@/services/exportService'

interface LanguageExportModalProps {
  onClose: () => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // navegadores sin permiso de portapapeles: copia clásica
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Copia la columna de idioma (CAT/ESP) alineada con las filas de la Google Sheet, para pegarla en H1. */
export default function LanguageExportModal({ onClose }: LanguageExportModalProps) {
  const guests = useProjectStore((s) => s.project.guests)
  const sheetUrl = useProjectStore((s) => s.project.guestSheetUrl)
  const pushToast = useProjectStore((s) => s.pushToast)
  const [result, setResult] = useState<LanguageColumnResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    buildLanguageColumn(sheetUrl, guests)
      .then(setResult)
      .catch((err) => pushToast('error', err instanceof Error ? err.message : 'No se ha podido preparar la columna.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const missing = result?.rows.filter((r) => r.status === 'sin-idioma') ?? []
  const notFound = result?.rows.filter((r) => r.status === 'no-encontrado') ?? []

  const copy = async () => {
    if (!result) return
    const ok = await copyText(result.text)
    pushToast(ok ? 'success' : 'error', ok ? `Columna copiada (${result.rows.length} filas). Pégala en la celda H1.` : 'No se ha podido copiar. Usa "Descargar CSV".')
  }

  return (
    <Modal onClose={onClose} width={560}>
      <h2>Idioma → Google Sheet (columna H)</h2>
      <p className="text-soft text-sm" style={{ marginTop: 6 }}>
        Copia una columna con <strong>Idioma</strong> en la primera línea y un CAT/ESP por cada fila de la hoja, en el mismo orden.
        En Google Sheets haz clic en la celda <strong>H1</strong> y pega (Ctrl/Cmd + V).
      </p>

      {loading && <p className="text-muted text-sm" style={{ marginTop: 12 }}>Leyendo la hoja para respetar su orden actual…</p>}

      {result && !loading && (
        <>
          <div className="flex gap-2" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <span className="chip chip-success">{result.rows.filter((r) => r.status === 'ok').length} con idioma</span>
            {missing.length > 0 && <span className="chip chip-warning">{missing.length} sin idioma (celda vacía)</span>}
            {notFound.length > 0 && <span className="chip chip-error">{notFound.length} filas sin invitado en la app</span>}
          </div>
          {!result.live && (
            <p className="text-sm" style={{ marginTop: 8, color: 'var(--color-warning)' }}>
              No se ha podido leer la hoja ahora mismo; se usa el orden de la última sincronización. Si has añadido o movido filas, sincroniza antes de pegar.
            </p>
          )}
          {result.notInSheet.length > 0 && (
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              No están en la hoja y no se exportan: {result.notInSheet.slice(0, 5).join(', ')}{result.notInSheet.length > 5 ? '…' : ''}
            </p>
          )}

          <div className="lang-export-preview">
            <table>
              <thead>
                <tr><th>Fila</th><th>Nombre (columna A)</th><th>H</th></tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{r.name}</td>
                    <td className={r.status === 'ok' ? '' : 'is-missing'}>{r.value || (r.status === 'no-encontrado' ? '¿?' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={load} disabled={loading}>⟳ Releer hoja</button>
        <button className="btn btn-secondary" onClick={() => result && exportLanguageCsv(result)} disabled={!result}>⬇ Descargar CSV</button>
        <button className="btn btn-primary" onClick={copy} disabled={!result}>📋 Copiar columna H</button>
      </div>
    </Modal>
  )
}
