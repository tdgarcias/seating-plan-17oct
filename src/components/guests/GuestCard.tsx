import type { Guest } from '@/types'

interface GuestCardProps {
  guest: Guest
  selected: boolean
  tableName?: string
  onToggleSelect: (id: string, additive: boolean) => void
  onOpenDetail: (id: string) => void
}

const STATUS_LABEL: Record<Guest['status'], string> = {
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado'
}
const STATUS_CLASS: Record<Guest['status'], string> = {
  confirmado: 'chip-success',
  pendiente: 'chip-warning',
  rechazado: 'chip-error'
}

export default function GuestCard({ guest, selected, tableName, onToggleSelect, onOpenDetail }: GuestCardProps) {
  return (
    <div
      className={`guest-card ${selected ? 'is-selected' : ''} ${guest.isCouple ? 'is-couple' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-guest-id', guest.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={(e) => onToggleSelect(guest.id, e.metaKey || e.ctrlKey || e.shiftKey)}
    >
      <div className="guest-card-main">
        <p className={`guest-card-name ${guest.isCouple ? 'is-couple-text' : ''}`}>
          {guest.isCouple && '♥ '}{guest.fullName}
        </p>
        <div className="guest-card-meta">
          {guest.role && <span className="text-muted text-sm truncate">{guest.role}</span>}
          {!guest.role && guest.group && <span className="text-muted text-sm truncate">{guest.group}</span>}
          {guest.companions > 0 && <span className="chip chip-neutral">+{guest.companions}</span>}
        </div>
      </div>
      <div className="guest-card-side">
        {tableName ? (
          <span className="chip chip-info truncate" title={tableName}>{tableName}</span>
        ) : (
          <span className={`chip ${STATUS_CLASS[guest.status]}`}>{STATUS_LABEL[guest.status]}</span>
        )}
        <button
          className="btn-icon btn-ghost btn-sm"
          title="Ver detalle"
          onClick={(e) => { e.stopPropagation(); onOpenDetail(guest.id) }}
        >
          ⓘ
        </button>
      </div>
    </div>
  )
}
