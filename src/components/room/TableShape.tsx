import { useMemo, useRef } from 'react'
import type { Guest, TableItem } from '@/types'
import { computeSeatPositions } from '@/utils/geometry'
import { dietaryColors, hasDietary, isBaby, isSevere, GIFT_ICON } from '@/utils/dietary'
import { sectionRanges } from '@/utils/sections'
import { languageAbbr } from '@/utils/language'

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
  const sections = useMemo(() => sectionRanges(table), [table])
  const bodyLen = table.length ?? 0.9
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

      {sections.length > 0 && (
        <g className="table-sections">
          {sections.map((r) => (
            <g key={r.section.id}>
              {r.index % 2 === 1 && (
                <rect className="section-band" x={r.drawX0} y={-bodyLen / 2} width={r.drawX1 - r.drawX0} height={bodyLen} />
              )}
              {r.index > 0 && (
                <line className="section-divider" x1={r.drawX0} x2={r.drawX0} y1={-bodyLen / 2 - 0.68} y2={bodyLen / 2 + 0.68} />
              )}
              <text
                className="section-label" textAnchor="middle" dominantBaseline="central"
                transform={`translate(${(r.drawX0 + r.drawX1) / 2} ${bodyLen * 0.22}) rotate(${-table.rotation})`}
              >
                {r.section.label}
              </text>
            </g>
          ))}
        </g>
      )}

      {sections.length > 0 && (showNames || showGuestCount) && (
        // con submesas: nombre y ocupación en una sola línea, en la mitad superior
        <text className="table-label" textAnchor="middle" transform={`translate(0 ${-bodyLen * 0.1}) rotate(${-table.rotation})`}>
          {showNames ? table.name : ''}
          {showGuestCount && (
            <tspan className={`table-capacity ${overCapacity ? 'is-over' : ''}`}>{showNames ? ' · ' : ''}{occupants.length}/{table.capacity}</tspan>
          )}
        </text>
      )}
      {sections.length === 0 && showNames && (
        <text className="table-label" textAnchor="middle" dy="-0.02" transform={`rotate(${-table.rotation})`}>
          {table.name}
        </text>
      )}
      {sections.length === 0 && showGuestCount && (
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
          {seat.guest && isBaby(seat.guest.dietary) ? (
            // bebé: trona en lugar de silla
            <rect x={-0.19} y={-0.19} width={0.38} height={0.38} rx={0.06} className="seat-dot seat-highchair" />
          ) : (
            <circle r={0.19} className="seat-dot" />
          )}
          {seat.guest && (
            <text
              className={`seat-label ${seat.guest.isCouple ? 'is-couple' : ''} ${showFullNames ? 'is-full-name' : ''}`}
              textAnchor="middle" dy="0.065" transform={`rotate(${-table.rotation})`}
            >
              {showFullNames ? seat.guest.fullName : initials(seat.guest.fullName)}
            </text>
          )}
          {seat.guest && hasDietary(seat.guest.dietary) && (
            <g className={`seat-diet-marker ${isSevere(seat.guest.dietary) ? 'is-severe' : ''}`} transform="translate(0.15 -0.15)">
              {/* marca dividida con el color de cada categoría */}
              {(() => {
                const colors = dietaryColors(seat.guest.dietary)
                if (colors.length <= 1) return <circle r={0.075} style={colors[0] ? { fill: colors[0] } : undefined} />
                return colors.map((c, i) => {
                  const a0 = (i / colors.length) * 2 * Math.PI - Math.PI / 2
                  const a1 = ((i + 1) / colors.length) * 2 * Math.PI - Math.PI / 2
                  const r = 0.075
                  const large = a1 - a0 > Math.PI ? 1 : 0
                  const d = `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`
                  return <path key={i} d={d} style={{ fill: c }} />
                })
              })()}
            </g>
          )}
          {seat.guest?.language && (
            <text className="seat-lang-marker" x={0} y={0.29} textAnchor="middle" transform={`rotate(${-table.rotation} 0 0)`}>
              {languageAbbr(seat.guest.language)}
            </text>
          )}
          {seat.guest?.gift && (
            <text className="seat-gift-marker" x={-0.16} y={-0.12} textAnchor="middle" transform={`rotate(${-table.rotation} -0.16 -0.12)`}>
              {GIFT_ICON}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}
