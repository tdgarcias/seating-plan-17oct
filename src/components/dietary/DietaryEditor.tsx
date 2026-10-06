import type { AllergenCode, DietCode, DietaryInfo, DietarySeverity } from '@/types'
import { ALLERGENS, DIETS, SEVERITIES, parseDietaryText } from '@/utils/dietary'

interface DietaryEditorProps {
  value: DietaryInfo
  onChange: (value: DietaryInfo) => void
}

/** Editor de alergias/intolerancias: chips de los 14 alérgenos UE, dietas, gravedad y nota libre. */
export default function DietaryEditor({ value, onChange }: DietaryEditorProps) {
  const toggleAllergen = (code: AllergenCode) => {
    const allergens = value.allergens.includes(code)
      ? value.allergens.filter((a) => a !== code)
      : [...value.allergens, code]
    onChange({ ...value, allergens, severity: value.severity ?? (allergens.length ? 'alergia' : null) })
  }
  const toggleDiet = (code: DietCode) => {
    const diets = value.diets.includes(code) ? value.diets.filter((d) => d !== code) : [...value.diets, code]
    onChange({ ...value, diets, severity: value.severity ?? (diets.length ? 'preferencia' : null) })
  }
  const hasAny = value.allergens.length > 0 || value.diets.length > 0 || value.notes.trim() !== ''
  const sheetDiffers = value.sheetText && value.sheetText !== value.notes

  return (
    <div className="dietary-editor">
      <span className="dietary-editor-caption">Alérgenos (14 de declaración obligatoria UE)</span>
      <div className="dietary-chips">
        {ALLERGENS.map((a) => (
          <button
            key={a.code}
            type="button"
            className={`dietary-chip ${value.allergens.includes(a.code) ? 'is-on' : ''}`}
            onClick={() => toggleAllergen(a.code)}
            aria-pressed={value.allergens.includes(a.code)}
            title={a.label}
          >
            <span aria-hidden>{a.icon}</span> {a.label}
          </button>
        ))}
      </div>

      <span className="dietary-editor-caption">Dietas y menús especiales</span>
      <div className="dietary-chips">
        {DIETS.map((d) => (
          <button
            key={d.code}
            type="button"
            className={`dietary-chip ${value.diets.includes(d.code) ? 'is-on' : ''}`}
            onClick={() => toggleDiet(d.code)}
            aria-pressed={value.diets.includes(d.code)}
          >
            <span aria-hidden>{d.icon}</span> {d.label}
          </button>
        ))}
      </div>

      <div className="field-grid">
        <div className="field">
          <label>Gravedad</label>
          <select
            className="select"
            value={value.severity ?? ''}
            onChange={(e) => onChange({ ...value, severity: (e.target.value || null) as DietarySeverity | null })}
          >
            <option value="">— Sin indicar —</option>
            {SEVERITIES.map((s) => (
              <option key={s.code} value={s.code}>{s.label} · {s.hint}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Nota para cocina / camareros</label>
          <input
            className="input"
            value={value.notes}
            placeholder="Ej.: celíaca estricta, contaminación cruzada"
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
          />
        </div>
      </div>

      {sheetDiffers && (
        <div className="dietary-sheet-note text-sm">
          <span>En la hoja de Google: <em>{value.sheetText}</em></span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange({ ...parseDietaryText(value.sheetText!), sheetText: value.sheetText })}
          >
            Usar texto de la hoja
          </button>
        </div>
      )}

      {hasAny && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => onChange({ allergens: [], diets: [], severity: null, notes: '', sheetText: value.sheetText })}
        >
          Quitar todas las restricciones
        </button>
      )}
    </div>
  )
}
