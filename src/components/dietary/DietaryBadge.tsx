import type { DietaryInfo } from '@/types'
import { dietaryAbbrs, formatDietary, hasDietary, isSevere } from '@/utils/dietary'

/** Distintivo compacto con las abreviaturas (GLU · LAC). Rojo si es alergia grave. */
export default function DietaryBadge({ dietary, compact = false }: { dietary: DietaryInfo; compact?: boolean }) {
  if (!hasDietary(dietary)) return null
  const abbrs = dietaryAbbrs(dietary)
  const severe = isSevere(dietary)
  return (
    <span className={`dietary-badge ${severe ? 'is-severe' : ''}`} title={formatDietary(dietary)}>
      {severe ? '⚠' : '🍽'}
      {!compact && <span>{abbrs.length ? abbrs.join(' · ') : 'Nota'}</span>}
    </span>
  )
}
