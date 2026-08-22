import { useMemo } from 'react'
import type { Guest, TableItem } from '@/types'
import { computeSeatPositions } from '@/utils/geometry'

// React's SVG typings don't include `draggable`/drag events on <g>; usamos un pequeño
// componente propio para poder usar drag & drop nativo (arrastrar un invitado ya
// sentado a otra silla) sin pelearnos con los tipos de React para SVG.
type SeatGroupProps = React.SVGProps<SVGGElement> & {
  draggable?: boolean
  onDragStart?: (e: React.DragEvent<SVGGElement>) => void
}

function SeatGroup(props: SeatGroupProps) {
  return <g {...props} />
}

interface TableShapeProps {
  table: TableItem
  guests: Guest[]
  selected: boolean
  showNames: boolean
  showGuestCount: boolean
  showFullNames: boolean
  interactive: boolean
  onPointerDownTable: (e: React.PointerEvent, table: TableItem) => void
  onSelect: (id: string) => void
  onOpenEditor: (id: string) => void
  onDropGuestOnTable: (guestId: string, tableId: string) => void
  onDropGuestOnSeat: (guestId: string, tableId: string, seatIndex: number) => void
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TableShape({
  table, guests, selected, showNames, showGuestCount, showFullNames, interactive,
  onPointerDownTable, onSelect, onOpenEditor, onDropGuestOnTable, onDropGuestOnSeat
}: TableShapeProps) {
  const seats = useMemo(() => computeSeatPositions(table, guests), [table, guests])
  const occupants = guests.filter((g) => g.tableId === table.id)
  const overCapacity = occupants.length > table.capacity

  const allowDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-guest-id')) e.preventDefault()
  }

  return (
    <g
      transform={`translate(${table.x} ${table.y}) rotate(${table.rotation})`}
      className={`table-shape ${selected ? 'is-selected' : ''} ${table.locked ? 'is-locked' : ''}`}
      onPointerDown={(e) => interactive && onPointerDownTable(e, table)}
      onClick={(e) => { e.stopPropagation(); onSelect(table.id) }}
      onDoubleClick={(e) => { e.stopPropagation(); onOpenEditor(table.id) }}
      onDragOver={allowDrop}
      onDrop={(e) => {
        e.preventDefault()
        const guestId = e.dataTransfer.getData('application/x-guest-id')
        if (guestId) onDropGuestOnTable(guestId, table.id)
      }}
    >
      {table.type === 'round' ? (
        <circle r={(table.diameter ?? 1.5) / 2} className="table-body" style={{ fill: table.color }} />
      ) : (
        <rect
          x={-(table.width ?? 1.6) / 2}
          y={-(table.length ?? 0.9) / 2}
          width={table.width ?? 1.6}
          height={table.length ?? 0.9}
          rx={0.08}
          className="table-body"
          style={{ fill: table.color }}
        />
      )}

      {showNames && (
        <text className="table-label" textAnchor="middle" dy="-0.02" transform={`rotate(${-table.rotation})`}>
          {table.name}
        </text>
      )}
      {showGuestCount && (
        <text
          className={`table-capacity ${overCapacity ? 'is-over' : ''}`}
          textAnchor="middle"
          dy="0.32"
          transform={`rotate(${-table.rotation})`}
        >
          {occupants.length}/{table.capacity}
        </text>
      )}
      {table.locked && (
        <text className="table-lock" textAnchor="middle" dy="-0.42" transform={`rotate(${-table.rotation})`}>🔒</text>
      )}

      {seats.map((seat) => (
        <SeatGroup
          key={seat.index}
          transform={`translate(${seat.x} ${seat.y})`}
          className={`seat ${seat.guest ? 'is-occupied' : 'is-empty'}`}
          draggable={!!seat.guest}
          onPointerDown={(e) => { if (seat.guest) e.stopPropagation() }}
          onDragStart={(e) => {
            if (!seat.guest) return
            e.stopPropagation()
            e.dataTransfer.setData('application/x-guest-id', seat.guest.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={allowDrop}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const guestId = e.dataTransfer.getData('application/x-guest-id')
            if (guestId) onDropGuestOnSeat(guestId, table.id, seat.index)
          }}
        >
          <circle r={0.19} className="seat-dot" />
          {seat.guest && (
            <text
              className={`seat-label ${seat.guest.isCouple ? 'is-couple' : ''}`}
              textAnchor="middle" dy="0.065" transform={`rotate(${-table.rotation})`}
            >
              {showFullNames ? seat.guest.fullName : initials(seat.guest.fullName)}
            </text>
          )}
        </SeatGroup>
      ))}
    </g>
  )
}
