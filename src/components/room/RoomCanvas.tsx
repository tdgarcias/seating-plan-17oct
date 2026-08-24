import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import TableShape from './TableShape'
import RoomFeatureMarker from './RoomFeatureMarker'
import TableEditorModal from '@/components/tables/TableEditorModal'
import { computeAbsoluteSeatPositions } from '@/utils/geometry'
import type { RoomFeature, TableItem } from '@/types'

const MARGIN = 1.5

interface RoomCanvasProps {
  interactive?: boolean
  svgRef?: React.RefObject<SVGSVGElement>
  /** Fuerza mostrar nombres completos en los asientos, independientemente del ajuste guardado (usado en exportación). */
  forceFullNames?: boolean
}

function screenToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const transformed = pt.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

type DropTarget =
  | { kind: 'seat'; tableId: string; seatIndex: number }
  | { kind: 'table'; tableId: string }
  | { kind: 'unassign' }

/**
 * Busca, bajo unas coordenadas de pantalla, sobre qué asiento, mesa, o la zona
 * de "invitados sin asignar" (panel lateral) se ha soltado un invitado.
 */
function findDropTarget(clientX: number, clientY: number): DropTarget | null {
  const el = document.elementFromPoint(clientX, clientY)
  if (!el) return null

  const seatEl = (el as Element).closest('[data-seat-index]')
  if (seatEl) {
    const tableEl = seatEl.closest('[data-table-id]')
    if (tableEl) {
      const seatIndex = parseInt(seatEl.getAttribute('data-seat-index') ?? '', 10)
      const tableId = tableEl.getAttribute('data-table-id')
      if (tableId && !Number.isNaN(seatIndex)) return { kind: 'seat', tableId, seatIndex }
    }
  }

  const tableEl = (el as Element).closest('[data-table-id]')
  if (tableEl) {
    const tableId = tableEl.getAttribute('data-table-id')
    if (tableId) return { kind: 'table', tableId }
  }

  if ((el as Element).closest('[data-unassign-zone]')) return { kind: 'unassign' }

  return null
}

export default function RoomCanvas({ interactive = true, svgRef: externalRef, forceFullNames }: RoomCanvasProps) {
  const scenario = useActiveScenario()
  const guests = useProjectStore((s) => s.project.guests)
  const selectedTableId = useProjectStore((s) => s.ui.selectedTableId)
  const selectedFeatureId = useProjectStore((s) => s.ui.selectedFeatureId)
  const selectTable = useProjectStore((s) => s.selectTable)
  const selectFeature = useProjectStore((s) => s.selectFeature)
  const moveTable = useProjectStore((s) => s.moveTable)
  const moveRoomFeature = useProjectStore((s) => s.moveRoomFeature)
  const pushHistorySnapshot = useProjectStore((s) => s.pushHistorySnapshot)
  const assignGuestsToTable = useProjectStore((s) => s.assignGuestsToTable)
  const assignGuestToSeat = useProjectStore((s) => s.assignGuestToSeat)
  const unassignGuest = useProjectStore((s) => s.unassignGuest)
  const deleteTable = useProjectStore((s) => s.deleteTable)
  const deleteRoomFeature = useProjectStore((s) => s.deleteRoomFeature)
  const zoom = useProjectStore((s) => s.ui.zoom)
  const setZoom = useProjectStore((s) => s.setZoom)
  const pan = useProjectStore((s) => s.ui.pan)
  const setPan = useProjectStore((s) => s.setPan)
  const [editorTableId, setEditorTableId] = useState<string | null>(null)
  const [draggingGuestId, setDraggingGuestId] = useState<string | null>(null)
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const internalRef = useRef<SVGSVGElement>(null)
  const svgRef = externalRef ?? internalRef

  const dragState = useRef<{ kind: 'table' | 'feature'; id: string; offsetX: number; offsetY: number } | null>(null)
  const panState = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null)
  const guestDragState = useRef<{ guestId: string } | null>(null)

  const { room, tables, roomFeatures } = scenario
  const showFullNames = forceFullNames ?? room.showFullSeatNames

  const viewBox = useMemo(() => {
    const w = (room.widthMeters + MARGIN * 2) / zoom
    const h = (room.heightMeters + MARGIN * 2) / zoom
    const x = -MARGIN + pan.x
    const y = -MARGIN + pan.y
    return `${x} ${y} ${w} ${h}`
  }, [room.widthMeters, room.heightMeters, zoom, pan])

  const handlePointerDownTable = useCallback((e: React.PointerEvent, table: TableItem) => {
    if (table.locked) {
      selectTable(table.id)
      return
    }
    const svg = svgRef.current
    if (!svg) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const pt = screenToSvgPoint(svg, e.clientX, e.clientY)
    dragState.current = { kind: 'table', id: table.id, offsetX: pt.x - table.x, offsetY: pt.y - table.y }
    pushHistorySnapshot()
    selectTable(table.id)
  }, [pushHistorySnapshot, selectTable, svgRef])

  const handlePointerDownFeature = useCallback((e: React.PointerEvent, feature: RoomFeature) => {
    const svg = svgRef.current
    if (!svg) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const pt = screenToSvgPoint(svg, e.clientX, e.clientY)
    dragState.current = { kind: 'feature', id: feature.id, offsetX: pt.x - feature.x, offsetY: pt.y - feature.y }
    pushHistorySnapshot()
    selectFeature(feature.id)
  }, [pushHistorySnapshot, selectFeature, svgRef])

  /** Inicia el arrastre de un invitado ya sentado, para moverlo a otro asiento, otra mesa, o devolverlo a "sin asignar". */
  const handleSeatPointerDown = useCallback((e: React.PointerEvent, _tableId: string, _seatIndex: number, guestId: string) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    guestDragState.current = { guestId }
    setDraggingGuestId(guestId)
    setHoverTooltip(null)
  }, [])

  const handleSeatHoverStart = useCallback((tableId: string, seatIndex: number) => {
    const table = tables.find((t) => t.id === tableId)
    if (!table) return
    const abs = computeAbsoluteSeatPositions(table, guests)
    const seat = abs.find((s) => s.index === seatIndex)
    if (!seat || !seat.guest) return
    setHoverTooltip({ x: seat.x, y: seat.y, text: seat.guest.fullName })
  }, [tables, guests])

  const handleSeatHoverEnd = useCallback(() => {
    setHoverTooltip(null)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return
    if (guestDragState.current) {
      // El movimiento del invitado no necesita recalcular nada hasta soltar.
      return
    }
    if (dragState.current) {
      const pt = screenToSvgPoint(svg, e.clientX, e.clientY)
      const { kind, id, offsetX, offsetY } = dragState.current
      if (kind === 'table') moveTable(id, pt.x - offsetX, pt.y - offsetY)
      else moveRoomFeature(id, pt.x - offsetX, pt.y - offsetY)
    } else if (panState.current) {
      const dx = (e.clientX - panState.current.startX) / (svg.clientWidth / ((room.widthMeters + MARGIN * 2) / zoom))
      const dy = (e.clientY - panState.current.startY) / (svg.clientHeight / ((room.heightMeters + MARGIN * 2) / zoom))
      setPan({ x: panState.current.origin.x - dx, y: panState.current.origin.y - dy })
    }
  }, [moveTable, moveRoomFeature, room.widthMeters, room.heightMeters, zoom, setPan, svgRef])

  const endInteraction = useCallback((e: React.PointerEvent) => {
    if (guestDragState.current) {
      const { guestId } = guestDragState.current
      const target = findDropTarget(e.clientX, e.clientY)
      if (target) {
        if (target.kind === 'seat') assignGuestToSeat(guestId, target.tableId, target.seatIndex)
        else if (target.kind === 'table') assignGuestsToTable([guestId], target.tableId)
        else if (target.kind === 'unassign') unassignGuest(guestId)
      }
      guestDragState.current = null
      setDraggingGuestId(null)
    }
    dragState.current = null
    panState.current = null
  }, [assignGuestToSeat, assignGuestsToTable, unassignGuest])

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    selectTable(null)
    selectFeature(null)
    panState.current = { startX: e.clientX, startY: e.clientY, origin: pan }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!interactive) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTableId) deleteTable(selectedTableId)
        else if (selectedFeatureId) deleteRoomFeature(selectedFeatureId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedTableId, selectedFeatureId, deleteTable, deleteRoomFeature, interactive])

  const gridLines = useMemo(() => {
    if (!room.showGrid) return null
    const lines: JSX.Element[] = []
    const step = room.gridStepMeters
    for (let x = 0; x <= room.widthMeters + 0.001; x += step) {
      lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={room.heightMeters} className="grid-line" />)
    }
    for (let y = 0; y <= room.heightMeters + 0.001; y += step) {
      lines.push(<line key={`h${y}`} x1={0} y1={y} x2={room.widthMeters} y2={y} className="grid-line" />)
    }
    return lines
  }, [room.showGrid, room.gridStepMeters, room.widthMeters, room.heightMeters])

  const tooltipWidth = hoverTooltip ? Math.max(1.3, hoverTooltip.text.length * 0.145 + 0.35) : 0

  return (
    <div className={`room-canvas-wrap ${draggingGuestId ? 'is-dragging-guest' : ''}`}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="room-canvas"
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endInteraction}
        onPointerLeave={endInteraction}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-guest-id')) e.preventDefault() }}
      >
        <rect x={-MARGIN} y={-MARGIN} width={room.widthMeters + MARGIN * 2} height={room.heightMeters + MARGIN * 2} className="room-outer" />
        <rect x={0} y={0} width={room.widthMeters} height={room.heightMeters} className="room-floor" />
        {gridLines}
        <rect x={0} y={0} width={room.widthMeters} height={room.heightMeters} className="room-border" />

        {room.showMeasurements && (
          <>
            <text x={room.widthMeters / 2} y={-0.55} textAnchor="middle" className="room-measure">
              {room.widthMeters} m
            </text>
            <text x={-0.55} y={room.heightMeters / 2} textAnchor="middle" className="room-measure" transform={`rotate(-90 ${-0.55} ${room.heightMeters / 2})`}>
              {room.heightMeters} m
            </text>
          </>
        )}

        {roomFeatures.map((feature) => (
          <RoomFeatureMarker
            key={feature.id}
            feature={feature}
            selected={feature.id === selectedFeatureId}
            interactive={interactive}
            onPointerDownFeature={handlePointerDownFeature}
            onSelect={selectFeature}
          />
        ))}

        {tables.map((table) => (
          <TableShape
            key={table.id}
            table={table}
            guests={guests}
            selected={table.id === selectedTableId}
            showNames={room.showTableNames}
            showGuestCount={room.showGuestCount}
            showFullNames={showFullNames}
            interactive={interactive}
            onPointerDownTable={handlePointerDownTable}
            onSeatPointerDown={handleSeatPointerDown}
            onSeatHoverStart={handleSeatHoverStart}
            onSeatHoverEnd={handleSeatHoverEnd}
            onSelect={selectTable}
            onOpenEditor={setEditorTableId}
            onDropGuestOnTable={(guestId, tableId) => assignGuestsToTable([guestId], tableId)}
            onDropGuestOnSeat={assignGuestToSeat}
          />
        ))}

        {hoverTooltip && (
          <g transform={`translate(${hoverTooltip.x} ${hoverTooltip.y - 0.55})`} pointerEvents="none" className="seat-tooltip">
            <rect x={-tooltipWidth / 2} y={-0.24} width={tooltipWidth} height={0.42} rx={0.09} className="seat-tooltip-bg" />
            <text textAnchor="middle" dy="0.08" className="seat-tooltip-text">{hoverTooltip.text}</text>
          </g>
        )}
      </svg>

      {interactive && (
        <div className="canvas-zoom-controls">
          <button className="btn-icon btn-secondary btn-sm" onClick={() => setZoom(zoom - 0.25)}>−</button>
          <span className="text-sm">{Math.round(zoom * 100)}%</span>
          <button className="btn-icon btn-secondary btn-sm" onClick={() => setZoom(zoom + 0.25)}>+</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Ajustar</button>
        </div>
      )}

      {editorTableId && (
        <TableEditorModal tableId={editorTableId} onClose={() => setEditorTableId(null)} />
      )}
    </div>
  )
}
