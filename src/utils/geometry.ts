import type { Guest, RoomSettings, SeatPosition, SeatsPerSide, TableItem } from '@/types'

/** Convierte grados a radianes. */
const rad = (deg: number) => (deg * Math.PI) / 180

/** Rota un punto (dx, dy) alrededor del origen, un ángulo en grados. */
function rotatePoint(dx: number, dy: number, deg: number) {
  const r = rad(deg)
  return {
    x: dx * Math.cos(r) - dy * Math.sin(r),
    y: dx * Math.sin(r) + dy * Math.cos(r)
  }
}

/** Reparte n asientos por lado por defecto de forma lo más equilibrada posible. */
export function defaultSeatsPerSide(capacity: number): SeatsPerSide {
  const longSides = Math.ceil(capacity / 2)
  const top = Math.ceil(longSides / 2)
  const bottom = longSides - top
  const remaining = capacity - longSides
  const left = Math.ceil(remaining / 2)
  const right = remaining - left
  return { top, bottom, left, right }
}

function guestAt(table: TableItem, guests: Guest[], index: number): Guest | null {
  return guests.find((g) => g.tableId === table.id && g.seatIndex === index) ?? null
}

/** Calcula las posiciones (locales, metros, relativas al centro de la mesa) de cada asiento. */
export function computeSeatPositions(table: TableItem, guests: Guest[]): SeatPosition[] {
  if (table.type === 'round') {
    const radius = (table.diameter ?? 1.5) / 2 + 0.45
    const seats: SeatPosition[] = []
    for (let i = 0; i < table.capacity; i++) {
      const angleDeg = (360 / table.capacity) * i - 90
      const a = rad(angleDeg)
      seats.push({
        index: i,
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
        angle: angleDeg,
        guest: guestAt(table, guests, i)
      })
    }
    return seats
  }

  // Rectangular: distribuye por lados.
  const width = table.width ?? 1.6 // eje X local antes de rotar
  const length = table.length ?? 0.9 // eje Y local
  const sides = table.seatsPerSide ?? defaultSeatsPerSide(table.capacity)
  const margin = 0.45
  const seats: SeatPosition[] = []
  let idx = 0

  const place = (count: number, side: 'top' | 'bottom' | 'left' | 'right') => {
    for (let i = 0; i < count; i++) {
      let x = 0
      let y = 0
      let angle = 0
      const t = count === 1 ? 0.5 : i / (count - 1)
      if (side === 'top') {
        x = -width / 2 + t * width
        y = -length / 2 - margin
        angle = -90
      } else if (side === 'bottom') {
        x = -width / 2 + t * width
        y = length / 2 + margin
        angle = 90
      } else if (side === 'left') {
        x = -width / 2 - margin
        y = -length / 2 + t * length
        angle = 180
      } else {
        x = width / 2 + margin
        y = -length / 2 + t * length
        angle = 0
      }
      seats.push({ index: idx, x, y, angle, guest: guestAt(table, guests, idx) })
      idx++
    }
  }

  place(sides.top, 'top')
  place(sides.right, 'right')
  place(sides.bottom, 'bottom')
  place(sides.left, 'left')

  return seats.slice(0, table.capacity)
}

/** Posiciones de asientos ya rotadas y trasladadas a coordenadas absolutas de la sala (metros). */
export function computeAbsoluteSeatPositions(table: TableItem, guests: Guest[]): SeatPosition[] {
  return computeSeatPositions(table, guests).map((s) => {
    const rotated = rotatePoint(s.x, s.y, table.rotation)
    return { ...s, x: table.x + rotated.x, y: table.y + rotated.y, angle: s.angle + table.rotation }
  })
}

/** Caja delimitadora (sin rotar de forma precisa, aproximación conservadora) de una mesa, en metros. */
export function tableBounds(table: TableItem): { minX: number; minY: number; maxX: number; maxY: number } {
  let halfW: number
  let halfH: number
  if (table.type === 'round') {
    const r = (table.diameter ?? 1.5) / 2 + 0.5
    halfW = r
    halfH = r
  } else {
    const w = (table.width ?? 1.6) / 2 + 0.5
    const l = (table.length ?? 0.9) / 2 + 0.5
    // aproximación: usar la diagonal para cubrir cualquier rotación
    const diag = Math.sqrt(w * w + l * l)
    halfW = diag
    halfH = diag
  }
  return { minX: table.x - halfW, minY: table.y - halfH, maxX: table.x + halfW, maxY: table.y + halfH }
}

export function tablesOverlap(a: TableItem, b: TableItem): boolean {
  const ba = tableBounds(a)
  const bb = tableBounds(b)
  return ba.minX < bb.maxX && ba.maxX > bb.minX && ba.minY < bb.maxY && ba.maxY > bb.minY
}

export function tableOutOfBounds(table: TableItem, room: RoomSettings): boolean {
  const b = tableBounds(table)
  return b.minX < 0 || b.minY < 0 || b.maxX > room.widthMeters || b.maxY > room.heightMeters
}

export function snap(value: number, step: number, enabled: boolean): number {
  if (!enabled || step <= 0) return value
  return Math.round(value / step) * step
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
