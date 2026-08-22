import { useMemo, useState } from 'react'
import { useProjectStore, useActiveScenario, nextPaletteColor } from '@/store/useProjectStore'
import { computeValidationIssues } from '@/utils/validation'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import NumberField from '@/components/common/NumberField'
import TableEditorModal from './TableEditorModal'
import type { RoomFeatureType } from '@/types'

const PALETTE = Array.from({ length: 9 }, (_, i) => nextPaletteColor(i))

const FEATURE_TYPES: { type: RoomFeatureType; label: string; icon: string }[] = [
  { type: 'dj', label: 'DJ', icon: '🎧' },
  { type: 'banos', label: 'Baños', icon: '🚻' },
  { type: 'puerta', label: 'Puerta', icon: '🚪' },
  { type: 'barra', label: 'Barra', icon: '🍸' },
  { type: 'pista', label: 'Pista de baile', icon: '💃' },
  { type: 'otro', label: 'Otro', icon: '📍' }
]

export default function PropertiesPanel() {
  const scenario = useActiveScenario()
  const guests = useProjectStore((s) => s.project.guests)
  const incompatibilities = useProjectStore((s) => s.project.incompatibilities)
  const selectedTableId = useProjectStore((s) => s.ui.selectedTableId)
  const selectedFeatureId = useProjectStore((s) => s.ui.selectedFeatureId)
  const addTable = useProjectStore((s) => s.addTable)
  const updateTable = useProjectStore((s) => s.updateTable)
  const duplicateTable = useProjectStore((s) => s.duplicateTable)
  const deleteTable = useProjectStore((s) => s.deleteTable)
  const updateRoomSettings = useProjectStore((s) => s.updateRoomSettings)
  const addRoomFeature = useProjectStore((s) => s.addRoomFeature)
  const updateRoomFeature = useProjectStore((s) => s.updateRoomFeature)
  const deleteRoomFeature = useProjectStore((s) => s.deleteRoomFeature)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  const issues = useMemo(
    () => computeValidationIssues(scenario, guests, incompatibilities),
    [scenario, guests, incompatibilities]
  )
  const table = scenario.tables.find((t) => t.id === selectedTableId)
  const feature = scenario.roomFeatures.find((f) => f.id === selectedFeatureId)

  return (
    <aside className="properties-panel panel scroll-y">
      <div className="sidebar-section">
        <h3>Mesas</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1, minWidth: 110 }} onClick={() => addTable('round')}>◯ Redonda</button>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1, minWidth: 110 }} onClick={() => addTable('rect')}>▭ Rectangular</button>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Elementos de la sala</h3>
        <p className="text-muted text-sm" style={{ marginBottom: 8 }}>DJ, baños, puertas... para tener en cuenta al colocar las mesas.</p>
        <div className="feature-buttons">
          {FEATURE_TYPES.map((f) => (
            <button key={f.type} className="btn btn-secondary btn-sm" onClick={() => addRoomFeature(f.type, f.label)}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      </div>

      {table && (
        <div className="sidebar-section">
          <div className="flex justify-between items-center">
            <h4 className="truncate">{table.name}</h4>
            <button className="btn-icon btn-ghost btn-sm" title="Vista ampliada" onClick={() => setShowEditor(true)}>⤢</button>
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label>Nombre</label>
            <input className="input" value={table.name} onChange={(e) => updateTable(table.id, { name: e.target.value })} />
          </div>

          <div className="field-grid" style={{ marginTop: 8 }}>
            <div className="field">
              <label>Comensales</label>
              <NumberField
                value={table.capacity} min={1}
                onCommit={(v) => updateTable(table.id, { capacity: Math.max(1, Math.round(v)) })}
              />
            </div>
            <div className="field">
              <label>Rotación (°)</label>
              <NumberField
                value={table.rotation} min={0} max={359}
                onCommit={(v) => updateTable(table.id, { rotation: Math.round(v) })}
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <input
              type="range" min={0} max={359} value={table.rotation} style={{ width: '100%' }}
              onChange={(e) => updateTable(table.id, { rotation: parseInt(e.target.value) })}
            />
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label>Color</label>
            <div className="color-swatches">
              {PALETTE.map((c) => (
                <button
                  key={c} className={`color-swatch ${table.color === c ? 'is-selected' : ''}`}
                  style={{ background: c }} onClick={() => updateTable(table.id, { color: c })}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => updateTable(table.id, { locked: !table.locked })}>
              {table.locked ? '🔒 Desbloquear' : '🔓 Bloquear'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => duplicateTable(table.id)}>⧉ Duplicar</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>Eliminar</button>
          </div>
        </div>
      )}

      {feature && !table && (
        <div className="sidebar-section">
          <h4 className="truncate">{FEATURE_TYPES.find((f) => f.type === feature.type)?.icon} {feature.label}</h4>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Etiqueta</label>
            <input className="input" value={feature.label} onChange={(e) => updateRoomFeature(feature.id, { label: e.target.value })} />
          </div>
          <div className="field-grid" style={{ marginTop: 8 }}>
            <div className="field">
              <label>Posición X (m)</label>
              <NumberField value={feature.x} min={0} onCommit={(v) => updateRoomFeature(feature.id, { x: v })} />
            </div>
            <div className="field">
              <label>Posición Y (m)</label>
              <NumberField value={feature.y} min={0} onCommit={(v) => updateRoomFeature(feature.id, { y: v })} />
            </div>
          </div>
          <button className="btn btn-danger btn-sm" style={{ marginTop: 12 }} onClick={() => deleteRoomFeature(feature.id)}>
            Eliminar elemento
          </button>
        </div>
      )}

      {!table && !feature && (
        <div className="sidebar-section">
          <h4>Sala</h4>
          <div className="field-grid" style={{ marginTop: 8 }}>
            <div className="field">
              <label>Anchura (m)</label>
              <NumberField value={scenario.room.widthMeters} min={0} onCommit={(v) => updateRoomSettings({ widthMeters: v })} />
            </div>
            <div className="field">
              <label>Longitud (m)</label>
              <NumberField value={scenario.room.heightMeters} min={0} onCommit={(v) => updateRoomSettings({ heightMeters: v })} />
            </div>
          </div>

          <div className="flex-col gap-2" style={{ marginTop: 12 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={scenario.room.showGrid} onChange={(e) => updateRoomSettings({ showGrid: e.target.checked })} />
              Mostrar cuadrícula
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={scenario.room.snapToGrid} onChange={(e) => updateRoomSettings({ snapToGrid: e.target.checked })} />
              Ajustar a la cuadrícula
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={scenario.room.showMeasurements} onChange={(e) => updateRoomSettings({ showMeasurements: e.target.checked })} />
              Mostrar medidas
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={scenario.room.showTableNames} onChange={(e) => updateRoomSettings({ showTableNames: e.target.checked })} />
              Mostrar nombres de mesas
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={scenario.room.showGuestCount} onChange={(e) => updateRoomSettings({ showGuestCount: e.target.checked })} />
              Mostrar nº de invitados
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox" checked={scenario.room.showFullSeatNames}
                onChange={(e) => updateRoomSettings({ showFullSeatNames: e.target.checked })}
              />
              Mostrar nombre completo en asientos (en vez de iniciales)
            </label>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <h4>Avisos {issues.filter((i) => i.severity !== 'info').length > 0 && <span className="chip chip-warning">{issues.filter((i) => i.severity !== 'info').length}</span>}</h4>
        {issues.length === 0 && <p className="text-muted text-sm">Sin incidencias detectadas.</p>}
        <div className="flex-col gap-2" style={{ marginTop: 8 }}>
          {issues.map((issue) => (
            <div key={issue.id} className={`issue-row issue-${issue.severity}`}>
              {issue.message}
            </div>
          ))}
        </div>
      </div>

      {showEditor && table && <TableEditorModal tableId={table.id} onClose={() => setShowEditor(false)} />}
      {confirmDelete && table && (
        <ConfirmDialog
          title="Eliminar mesa"
          description={`Se eliminará "${table.name}". Los invitados asignados quedarán sin mesa. Puedes deshacerlo con Ctrl+Z.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { deleteTable(table.id); setConfirmDelete(false) }}
        />
      )}
    </aside>
  )
}
