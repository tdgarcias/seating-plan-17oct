import type { Project } from '@/types'

const STORAGE_KEY = 'seating-plan-boda:project:v1'
const BACKUP_KEY = 'seating-plan-boda:project:backup-before-v2'

/** Copia el proyecto guardado tal cual (formato antiguo) antes de migrarlo. Solo se hace una vez. */
export function backupStoredProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, raw)
  } catch {
    /* sin espacio o sin localStorage: la migración sigue igualmente */
  }
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Project
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Guarda el proyecto en localStorage con un pequeño debounce para no saturar en cada trazo. */
export function saveProjectDebounced(project: Project, delayMs = 400) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    } catch (err) {
      console.error('No se pudo guardar el proyecto en localStorage', err)
    }
  }, delayMs)
}

export function saveProjectNow(project: Project) {
  if (saveTimer) clearTimeout(saveTimer)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

export function clearStoredProject() {
  localStorage.removeItem(STORAGE_KEY)
}

export function downloadProjectFile(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safeName = (project.settings.coupleNames || 'seating-plan').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  a.href = url
  a.download = `${safeName}-proyecto.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function readProjectFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Project
        if (!parsed.scenarios || !parsed.guests) {
          reject(new Error('El archivo no tiene el formato esperado de un proyecto de seating plan.'))
          return
        }
        resolve(parsed)
      } catch {
        reject(new Error('No se ha podido leer el archivo. Comprueba que sea un JSON de proyecto válido.'))
      }
    }
    reader.onerror = () => reject(new Error('No se ha podido leer el archivo.'))
    reader.readAsText(file)
  })
}
