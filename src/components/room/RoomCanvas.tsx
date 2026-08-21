import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import TableShape from './TableShape'
import RoomFeatureMarker from './RoomFeatureMarker'
import TableEditorModal from '@/components/tables/TableEditorModal'
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
  const deleteTable = useProjectStore((s) => s.deleteTable)
  const deleteRoomFeature = useProjectStore((s) => s.deleteRoomFeature)
  const zoom = useProjectStore((s) => s.ui.zoom)
  const setZoom = useProjectStore((s) => s.setZoom)
  const pan = useProjectStore((s) => s.ui.pan)
  const setPan = useProjectStore((s) => s.setPan)
  const [editorTableId, setEditorTableId] = useState<string | null>(null)

  const internalRef = useRef<SVGSVGElement>(null)
  const svgRef = externalRef ?? internalRef

  const dragState = useRef<{ kind: 'table' | 'feature'; id: string; offsetX: number; offsetY: number } | null>(null)
  const panState = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null)

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

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return
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

  const endInteraction = useCallback(() => {
    dragState.current = null
    panState.current = null
  }, [])

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

  return (
    <div className="room-canvas-wrap">
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
            onSelect={selectTable}
            onOpenEditor={setEditorTableId}
            onDropGuestOnTable={(guestId, tableId) => assignGuestsToTable([guestId], tableId)}
            onDropGuestOnSeat={assignGuestToSeat}
          />
        ))}
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
