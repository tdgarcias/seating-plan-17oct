import { useMemo, useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import GuestCard from './GuestCard'
import GuestDetailModal from './GuestDetailModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Modal from '@/components/common/Modal'
import DietarySummaryModal from '@/components/dietary/DietarySummaryModal'
import { hasDietary } from '@/utils/dietary'
import { LANGUAGES } from '@/utils/language'
import { guestTableLabel } from '@/utils/sections'
import LanguageExportModal from '@/components/export/LanguageExportModal'

type Filter = 'todos' | 'sin-asignar' | 'asignados' | 'restricciones' | 'regalos'

export default function GuestList() {
  const project = useProjectStore((s) => s.project)
  const scenario = useActiveScenario()
  const guestLoadStatus = useProjectStore((s) => s.ui.guestLoadStatus)
  const guestLoadError = useProjectStore((s) => s.ui.guestLoadError)
  const syncGuestsFromSheet = useProjectStore((s) => s.syncGuestsFromSheet)
  const loadDemoGuests = useProjectStore((s) => s.loadDemoGuests)
  const setGuestSheetUrl = useProjectStore((s) => s.setGuestSheetUrl)
  const selectedGuestIds = useProjectStore((s) => s.ui.selectedGuestIds)
  const setSelectedGuestIds = useProjectStore((s) => s.setSelectedGuestIds)
  const assignGuestsToTable = useProjectStore((s) => s.assignGuestsToTable)
  const autoDistribute = useProjectStore((s) => s.autoDistribute)
  const setGuestsLanguage = useProjectStore((s) => s.setGuestsLanguage)

  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState<'todos' | Guest_Status>('todos')
  const [filter, setFilter] = useState<Filter>('todos')
  const [langFilter, setLangFilter] = useState<'todos' | 'ca' | 'es' | 'none'>('todos')
  const [langExportOpen, setLangExportOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState('')
  const [distributeMode, setDistributeMode] = useState<'random' | 'byGroup' | 'balanced' | null>(null)
  const [sheetModalOpen, setSheetModalOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(project.guestSheetUrl)
  const [dietSummaryOpen, setDietSummaryOpen] = useState(false)
  const dietaryCount = project.guests.filter((g) => g.status !== 'rechazado' && hasDietary(g.dietary)).length
  const giftCount = project.guests.filter((g) => g.status !== 'rechazado' && g.gift).length
  const activeGuests = project.guests.filter((g) => g.status !== 'rechazado')
  const langCounts = { ca: activeGuests.filter((g) => g.language === 'ca').length, es: activeGuests.filter((g) => g.language === 'es').length, none: activeGuests.filter((g) => !g.language).length }

  const tableLabel = (g: { tableId: string | null; seatIndex: number | null }) => (g.tableId ? guestTableLabel(scenario, g, false) || undefined : undefined)

  const groups = useMemo(() => Array.from(new Set(project.guests.map((g) => g.group).filter(Boolean))), [project.guests])

  const filtered = project.guests.filter((g) => {
    if (search && !g.fullName.toLowerCase().includes(search.toLowerCase())) return false
    if (groupFilter !== 'todos' && g.group !== groupFilter) return false
    if (statusFilter !== 'todos' && g.status !== statusFilter) return false
    if (filter === 'sin-asignar' && g.tableId) return false
    if (filter === 'asignados' && !g.tableId) return false
    if (filter === 'restricciones' && !hasDietary(g.dietary)) return false
    if (filter === 'regalos' && !g.gift) return false
    if (langFilter === 'none' ? !!g.language : langFilter !== 'todos' && g.language !== langFilter) return false
    return true
  })

  const totalGuests = project.guests.length
  const assignedGuests = project.guests.filter((g) => g.tableId).length
  const capacity = scenario.tables.reduce((sum, t) => sum + t.capacity, 0)
  const occupancy = capacity > 0 ? ((assignedGuests / capacity) * 100).toFixed(1) : '0'

  const toggleSelect = (id: string, additive: boolean) => {
    if (additive) {
      setSelectedGuestIds(
        selectedGuestIds.includes(id) ? selectedGuestIds.filter((i) => i !== id) : [...selectedGuestIds, id]
      )
    } else {
      setSelectedGuestIds(selectedGuestIds.includes(id) && selectedGuestIds.length === 1 ? [] : [id])
    }
  }

  return (
    <aside className="sidebar panel" data-unassign-zone="true">
      <div className="sidebar-section">
        <div className="flex justify-between items-center">
          <h3>Invitados</h3>
          <button className="btn-icon btn-ghost btn-sm" title="Configurar Google Sheets" onClick={() => setSheetModalOpen(true)}>⚙</button>
        </div>

        <div className="guest-source-status text-sm">
          {guestLoadStatus === 'loading' && <span className="text-muted">Cargando invitados…</span>}
          {guestLoadStatus === 'success' && <span className="text-muted">
            {project.lastGuestSync ? `Última actualización: ${new Date(project.lastGuestSync).toLocaleString('es-ES')}` : 'Invitados cargados correctamente'}
          </span>}
          {guestLoadStatus === 'error' && <span style={{ color: 'var(--color-error)' }}>{guestLoadError}</span>}
          {guestLoadStatus === 'idle' && totalGuests === 0 && <span className="text-muted">Ningún invitado cargado todavía.</span>}
        </div>

        <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => syncGuestsFromSheet()} disabled={guestLoadStatus === 'loading'}>
            ⟳ Actualizar invitados
          </button>
          {totalGuests === 0 && (
            <button className="btn btn-ghost btn-sm" onClick={loadDemoGuests}>Cargar datos de ejemplo</button>
          )}
        </div>
      </div>

      <div className="sidebar-stats">
        <div><strong>{totalGuests}</strong><span>Invitados</span></div>
        <div><strong>{assignedGuests}</strong><span>Asignados</span></div>
        <div><strong>{totalGuests - assignedGuests}</strong><span>Sin asignar</span></div>
        <div><strong>{scenario.tables.length}</strong><span>Mesas</span></div>
        <div><strong>{capacity}</strong><span>Capacidad</span></div>
        <div><strong>{occupancy}%</strong><span>Ocupación</span></div>
      </div>
      <button className="dietary-summary-link text-sm" onClick={() => setDietSummaryOpen(true)}>
        🍽 {dietaryCount} invitado(s) con alergias o dietas · ver resumen
      </button>
      {giftCount > 0 && (
        <button className="dietary-summary-link text-sm" onClick={() => setFilter('regalos')}>
          🎁 {giftCount} regalo(s) en mesa · ver quién
        </button>
      )}
      {totalGuests > 0 && (
        <div className="dietary-summary-link text-sm lang-summary">
          <span>🗣 CAT {langCounts.ca} · ESP {langCounts.es}</span>
          {langCounts.none > 0 && <button className="link-button" onClick={() => setLangFilter('none')}>{langCounts.none} sin idioma</button>}
          <button className="link-button" onClick={() => setLangExportOpen(true)} title="Copiar la columna de idioma para pegarla en la Google Sheet">→ Sheet (col. H)</button>
        </div>
      )}

      <div className="sidebar-section">
        <input
          className="input" placeholder="Buscar por nombre o apellido…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="input-row" style={{ marginTop: 8 }}>
          <select className="select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="todos">Todos los grupos</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            className="select" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | Guest_Status)}
          >
            <option value="todos">Cualquier estado</option>
            <option value="confirmado">Confirmado</option>
            <option value="pendiente">Pendiente</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        <div className="input-row" style={{ marginTop: 8 }}>
          <select className="select" value={langFilter} onChange={(e) => setLangFilter(e.target.value as typeof langFilter)}>
            <option value="todos">Cualquier idioma</option>
            <option value="ca">Solo CAT</option>
            <option value="es">Solo ESP</option>
            <option value="none">Sin idioma</option>
          </select>
          <button
            className="btn btn-ghost btn-sm" disabled={!filtered.length}
            onClick={() => setSelectedGuestIds(filtered.map((g) => g.id))}
            title="Seleccionar todos los invitados que se ven en la lista"
          >
            Seleccionar {filtered.length}
          </button>
        </div>
        <div className="segmented" style={{ marginTop: 8 }}>
          <button className={filter === 'todos' ? 'is-active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          <button className={filter === 'sin-asignar' ? 'is-active' : ''} onClick={() => setFilter('sin-asignar')}>Sin mesa</button>
          <button className={filter === 'asignados' ? 'is-active' : ''} onClick={() => setFilter('asignados')}>Asignados</button>
          <button className={filter === 'restricciones' ? 'is-active' : ''} onClick={() => setFilter('restricciones')} title="Con alergias, intolerancias o dietas">Alergias</button>
          <button className={filter === 'regalos' ? 'is-active' : ''} onClick={() => setFilter('regalos')} title="Con regalo en la mesa">🎁</button>
        </div>
      </div>

      {selectedGuestIds.length > 0 && (
        <div className="sidebar-bulk-bar">
          <span className="text-sm">{selectedGuestIds.length} seleccionado(s)</span>
          <select className="select" value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)}>
            <option value="">Asignar a mesa…</option>
            {scenario.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            className="btn btn-primary btn-sm"
            disabled={!assignTarget}
            onClick={() => { assignGuestsToTable(selectedGuestIds, assignTarget); setSelectedGuestIds([]); setAssignTarget('') }}
          >
            Asignar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedGuestIds([])}>Cancelar</button>
          <div className="lang-bulk">
            <span className="text-sm text-muted">Idioma:</span>
            {LANGUAGES.map((l) => (
              <button key={l.code} className="btn btn-secondary btn-sm" onClick={() => setGuestsLanguage(selectedGuestIds, l.code)}>{l.abbr}</button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setGuestsLanguage(selectedGuestIds, null)} title="Quitar idioma">—</button>
          </div>
        </div>
      )}

      <div className="scroll-y sidebar-guest-list">
        {filtered.length === 0 && (
          <p className="text-muted text-sm" style={{ padding: '16px' }}>
            {totalGuests === 0 ? 'Importa invitados desde Google Sheets o carga datos de ejemplo.' : 'Ningún invitado coincide con la búsqueda.'}
          </p>
        )}
        {filtered.map((g) => (
          <GuestCard
            key={g.id}
            guest={g}
            selected={selectedGuestIds.includes(g.id)}
            tableName={tableLabel(g)}
            onToggleSelect={toggleSelect}
            onOpenDetail={setDetailId}
          />
        ))}
      </div>

      {scenario.tables.length > 0 && totalGuests - assignedGuests > 0 && (
        <div className="sidebar-section">
          <button className="btn btn-terracotta" style={{ width: '100%' }} onClick={() => setDistributeMode('balanced')}>
            ⚄ Distribuir automáticamente
          </button>
        </div>
      )}

      {dietSummaryOpen && <DietarySummaryModal onClose={() => setDietSummaryOpen(false)} />}
      {langExportOpen && <LanguageExportModal onClose={() => setLangExportOpen(false)} />}

      {detailId && <GuestDetailModal guestId={detailId} onClose={() => setDetailId(null)} />}

      {distributeMode && (
        <Modal onClose={() => setDistributeMode(null)} width={420}>
          <h2>Distribuir automáticamente</h2>
          <p className="text-soft text-sm" style={{ marginTop: 8 }}>
            Se asignará mesa a los {totalGuests - assignedGuests} invitados sin colocar, respetando el espacio libre de cada mesa.
          </p>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Criterio</label>
            <select
            className="select" value={distributeMode}
            onChange={(e) => setDistributeMode(e.target.value as 'random' | 'byGroup' | 'balanced')}
          >
              <option value="balanced">Equilibrar mesas</option>
              <option value="byGroup">Mantener grupos/familias juntos</option>
              <option value="random">Aleatorio</option>
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setDistributeMode(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => { autoDistribute(distributeMode); setDistributeMode(null) }}>
              Distribuir
            </button>
          </div>
        </Modal>
      )}

      {sheetModalOpen && (
        <Modal onClose={() => setSheetModalOpen(false)} width={480}>
          <h2>Origen de los invitados</h2>
          <p className="text-soft text-sm" style={{ marginTop: 8 }}>
            Pega el enlace de tu Google Sheet. Debe estar compartida como "Cualquier persona con el enlace puede ver".
          </p>
          <div className="field" style={{ marginTop: 12 }}>
            <label>URL de Google Sheets</label>
            <input className="input" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setSheetModalOpen(false)}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={() => { setGuestSheetUrl(urlDraft); syncGuestsFromSheet(urlDraft); setSheetModalOpen(false) }}
            >
              Guardar y actualizar
            </button>
          </div>
        </Modal>
      )}
    </aside>
  )
}

type Guest_Status = 'confirmado' | 'pendiente' | 'rechazado'
