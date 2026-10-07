import { useState } from 'react'
import Modal from '@/components/common/Modal'
import { useProjectStore } from '@/store/useProjectStore'

/** Datos de la boda: nombres de los novios, lugar y fecha (se usan en la cabecera y en las impresiones). */
export default function WeddingSettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useProjectStore((s) => s.project.settings)
  const updateSettings = useProjectStore((s) => s.updateSettings)
  const [draft, setDraft] = useState(settings)

  const save = () => {
    updateSettings({
      coupleNames: draft.coupleNames.trim() || settings.coupleNames,
      venue: draft.venue.trim(),
      weddingDate: draft.weddingDate
    })
    onClose()
  }

  return (
    <Modal onClose={onClose} width={440}>
      <h2>Datos de la boda</h2>
      <p className="text-soft text-sm" style={{ marginTop: 4 }}>
        Aparecen en la cabecera de la app y en el título y el pie de página de las impresiones.
      </p>
      <div className="flex-col gap-3" style={{ marginTop: 14 }}>
        <div className="field">
          <label>Novios</label>
          <input className="input" value={draft.coupleNames} placeholder="Cati & Tomeu"
            onChange={(e) => setDraft({ ...draft, coupleNames: e.target.value })} />
        </div>
        <div className="field-grid">
          <div className="field">
            <label>Lugar</label>
            <input className="input" value={draft.venue} placeholder="Els Calderers"
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" className="input" value={draft.weddingDate}
              onChange={(e) => setDraft({ ...draft, weddingDate: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save}>Guardar</button>
      </div>
    </Modal>
  )
}
