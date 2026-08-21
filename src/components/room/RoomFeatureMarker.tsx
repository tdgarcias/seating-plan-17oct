import type { RoomFeature } from '@/types'

const ICONS: Record<RoomFeature['type'], string> = {
  dj: '🎧',
  banos: '🚻',
  puerta: '🚪',
  barra: '🍸',
  pista: '💃',
  otro: '📍'
}

interface RoomFeatureMarkerProps {
  feature: RoomFeature
  selected: boolean
  interactive: boolean
  onPointerDownFeature: (e: React.PointerEvent, feature: RoomFeature) => void
  onSelect: (id: string) => void
}

export default function RoomFeatureMarker({ feature, selected, interactive, onPointerDownFeature, onSelect }: RoomFeatureMarkerProps) {
  return (
    <g
      transform={`translate(${feature.x} ${feature.y})`}
      className={`room-feature ${selected ? 'is-selected' : ''}`}
      onPointerDown={(e) => interactive && onPointerDownFeature(e, feature)}
      onClick={(e) => { e.stopPropagation(); onSelect(feature.id) }}
    >
      <circle r={0.32} className="room-feature-dot" />
      <text textAnchor="middle" dy="0.13" className="room-feature-icon">{ICONS[feature.type]}</text>
      <text textAnchor="middle" y={0.62} className="room-feature-label">{feature.label}</text>
    </g>
  )
}
