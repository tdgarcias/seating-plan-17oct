import type { GiftInfo } from '@/types'
import { GIFT_ICON } from '@/utils/dietary'

/** Marca si el invitado tiene un regalo o detalle en su sitio y qué es. */
export default function GiftEditor({ value, onChange }: { value: GiftInfo | null; onChange: (v: GiftInfo | null) => void }) {
  return (
    <div className="gift-editor">
      <label className="checkbox-row">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? { description: '' } : null)} />
        <span aria-hidden>{GIFT_ICON}</span> Tiene un regalo o detalle en su sitio
      </label>
      {value && (
        <input
          className="input"
          autoFocus
          value={value.description}
          placeholder="¿Qué regalo es? Ej.: ramo, botella de vino, detalle padrinos…"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      )}
    </div>
  )
}
