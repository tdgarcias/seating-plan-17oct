import { useMemo, useRef } from 'react'
import type { Guest, TableItem } from '@/types'
import { computeSeatPositions } from '@/utils/geometry'

interface TableShapeProps {
  table: TableItem
  guests: Guest[]
  selected: boolean
  showNames: boolean
  showGuestCount: boolean
  showFullNames: boolean
  interactive: boolean
  onPointerDownTable: (e: React.PointerEvent, table: TableItem) => void
  onSeatPointerDown: (e: React.PointerEvent, tableId: string, seatIndex: number, guestId: string) => void
  onSeatHoverStart: (tableId: string, seatIndex: number) => void
  onSeatHoverEnd: () => void
  onSelect: (id: string) => void
  onOpenEditor: (id: string) => void
  onDropGuestOnTable: (guestId: string, tableId: string) => void
  onDropGuestOnSeat: (guestId: string, tableId: string, seatIndex: number) => void
}

const HOVER_DELAY_MS = 1000

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TableShape({
  table, guests, selected, showNames, showGuestCount, showFullNames, interactive,
  onPointerDownTable, onSeatPointerDown, onSeatHoverStart, onSeatHoverEnd,
  onSelect, onOpenEditor, onDropGuestOnTable, onDropGuestOnSeat
}: TableShapeProps) {
  const seats = useMemo(() => computeSeatPositions(table, guests), [table, guests])
  const occupants = guests.filter((g) => g.tableId === table.id)
  const overCapacity = occupants.length > table.capacity
  const hoverTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const allowDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-guest-id')) e.preventDefault()
  }

  const clearHoverTimer = (seatIndex: number) => {
    const timer = hoverTimers.current.get(seatIndex)
    if (timer) {
      clearTimeout(timer)
      hoverTimers.current.delete(seatIndex)
    }
  }

  return (
    <g
      data-table-id={table.id}
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
        <g
          key={seat.index}
          data-seat-index={seat.index}
          transform={`translate(${seat.x} ${seat.y})`}
          className={`seat ${seat.guest ? 'is-occupied' : 'is-empty'}`}
          onPointerDown={(e) => {
            if (!seat.guest || !interactive) return
            clearHoverTimer(seat.index)
            onSeatHoverEnd()
            e.stopPropagation()
            onSeatPointerDown(e, table.id, seat.index, seat.guest.id)
          }}
          onPointerEnter={() => {
            if (!seat.guest || !interactive) return
            clearHoverTimer(seat.index)
            const timer = setTimeout(() => onSeatHoverStart(table.id, seat.index), HOVER_DELAY_MS)
            hoverTimers.current.set(seat.index, timer)
          }}
          onPointerLeave={() => {
            clearHoverTimer(seat.index)
            onSeatHoverEnd()
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
              className={`seat-label ${seat.guest.isCouple ? 'is-couple' : ''} ${showFullNames ? 'is-full-name' : ''}`}
              textAnchor="middle" dy="0.065" transform={`rotate(${-table.rotation})`}
            >
              {showFullNames ? `${initials(seat.guest.fullName)} ${seat.guest.fullName}` : initials(seat.guest.fullName)}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}
