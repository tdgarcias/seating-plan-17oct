import type { ConfirmationStatus, Guest, GuestGroup } from '@/types'
import { createId } from '@/utils/id'

const FIRST_NAMES = [
  'Joan', 'Maria', 'Antoni', 'Catalina', 'Miquel', 'Francesca', 'Bartomeu', 'Margalida',
  'Pere', 'Aina', 'Guillem', 'Isabel', 'Sebastià', 'Coloma', 'Rafel', 'Magdalena',
  'Llorenç', 'Joana', 'Gabriel', 'Antònia', 'Jaume', 'Bàrbara', 'Andreu', 'Apol·lònia',
  'Mateu', 'Neus', 'Damià', 'Elena', 'Tomeu', 'Sofia', 'Lucas', 'Marta', 'Diego', 'Laura',
  'Pablo', 'Carmen', 'Alejandro', 'Paula', 'Daniel', 'Nuria'
]
const LAST_NAMES = [
  'Bennàssar', 'Ferrer', 'Pons', 'Salom', 'Riutort', 'Vidal', 'Bonet', 'Serra',
  'Rosselló', 'Mas', 'Nadal', 'Estarellas', 'Sastre', 'Company', 'Colom', 'Amengual',
  'Cañellas', 'Ramis', 'Barceló', 'Truyols', 'García', 'López', 'Martínez', 'Fernández'
]
const GROUPS = [
  'Familia novia', 'Familia novio', 'Amigos universidad', 'Amigos trabajo', 'Amigos Mallorca', 'Padrinos'
]
const STATUSES: ConfirmationStatus[] = ['confirmado', 'confirmado', 'confirmado', 'pendiente', 'rechazado']
const DIETARY = ['', '', '', 'Vegetariano', 'Vegano', 'Celíaco', 'Alergia a frutos secos']
const ROLES = ['Familiar', 'Amigo/a', 'Compañero/a de trabajo', 'Familiar', 'Amigo/a']

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

export const DEMO_GROUPS: GuestGroup[] = [
  { id: createId('group'), name: 'Familia novia', color: '#8A5A44' },
  { id: createId('group'), name: 'Familia novio', color: '#6B7A4F' },
  { id: createId('group'), name: 'Amigos universidad', color: '#C1652F' },
  { id: createId('group'), name: 'Amigos trabajo', color: '#7C8FA6' },
  { id: createId('group'), name: 'Amigos Mallorca', color: '#B99A45' },
  { id: createId('group'), name: 'Padrinos', color: '#7A3B32' }
]

/** Genera invitados ficticios deterministas para desarrollo/demo sin conexión. */
export function generateDemoGuests(count = 50): Guest[] {
  const guests: Guest[] = []
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST_NAMES, i * 7 + 1)
    const last = pick(LAST_NAMES, i * 3 + 2)
    const groupName = pick(GROUPS, i)
    guests.push({
      id: createId('guest'),
      firstName: first,
      lastName: last,
      fullName: `${first} ${last}`,
      group: groupName,
      companions: i % 9 === 0 ? 1 : 0,
      status: pick(STATUSES, i * 5 + 3),
      notes: i % 13 === 0 ? 'Silla adaptada necesaria' : '',
      dietary: pick(DIETARY, i * 2 + 1),
      role: pick(ROLES, i * 4 + 1),
      isCouple: false,
      tableId: null,
      seatIndex: null
    })
  }
  // Los dos primeros invitados generados se marcan como los novios, para poder probar el resaltado visual.
  if (guests[0]) {
    guests[0] = { ...guests[0], fullName: `${guests[0].firstName} (Novia)`, role: 'Novios', isCouple: true, notes: 'NOVIA' }
  }
  if (guests[1]) {
    guests[1] = { ...guests[1], fullName: `${guests[1].firstName} (Novio)`, role: 'Novios', isCouple: true, notes: 'NOVIO' }
  }
  return guests
}

/** Un par de incompatibilidades de ejemplo entre los invitados de demostración (mismos índices que generateDemoGuests). */
export function generateDemoIncompatibilities(guests: Guest[]) {
  if (guests.length < 6) return []
  return [
    { id: createId('incomp'), guestAId: guests[3].id, guestBId: guests[5].id, note: 'Ex pareja' }
  ]
}
