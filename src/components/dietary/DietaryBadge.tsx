import type { DietaryInfo } from '@/types'
import { dietaryTags, formatDietary, hasDietary, isSevere } from '@/utils/dietary'

/** Distintivo compacto: icono de cada categoría con su color y las abreviaturas. Borde rojo si es alergia grave. */
export default function DietaryBadge({ dietary, compact = false }: { dietary: DietaryInfo; compact?: boolean }) {
  if (!hasDietary(dietary)) return null
  const tags = dietaryTags(dietary)
  const severe = isSevere(dietary)
  return (
    <span className={`dietary-badge ${severe ? 'is-severe' : ''}`} title={formatDietary(dietary)}>
      {severe && '⚠'}
      {tags.length === 0 && '🍽'}
      {tags.map((t) => (
        <span key={t.code} className="dietary-badge-tag" style={{ '--chip-color': t.color } as React.CSSProperties}>
          <span aria-hidden>{t.icon}</span>
          {!compact && <span>{t.abbr}</span>}
        </span>
      ))}
      {!compact && tags.length === 0 && <span>Nota</span>}
    </span>
  )
}
