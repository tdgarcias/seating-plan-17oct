import { ALLERGENS, DIETS, GIFT_ICON } from '@/utils/dietary'

let cache: Record<string, string> | null = null

/**
 * Convierte los emojis de cada categoría (los mismos que se ven en pantalla) en
 * miniaturas PNG para incrustarlas en el PDF. Se generan una vez y se reutilizan.
 */
export function getEmojiIcons(): Record<string, string> {
  if (cache) return cache
  const out: Record<string, string> = {}
  if (typeof document === 'undefined') return out
  const size = 72
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return out
  const entries: [string, string][] = [
    ...ALLERGENS.map((a) => [a.code, a.icon] as [string, string]),
    ...DIETS.map((d) => [d.code, d.icon] as [string, string]),
    ['gift', GIFT_ICON]
  ]
  entries.forEach(([code, emoji]) => {
    ctx.clearRect(0, 0, size, size)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.round(size * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`
    ctx.fillStyle = '#222'
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.04)
    try {
      out[code] = canvas.toDataURL('image/png')
    } catch {
      /* sin icono: el PDF dibuja un círculo del color de la categoría */
    }
  })
  cache = out
  return out
}
