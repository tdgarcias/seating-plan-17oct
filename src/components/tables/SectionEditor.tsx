import { useMemo, useState } from 'react'
import NumberField from '@/components/common/NumberField'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import { createId } from '@/utils/id'
import {
  canHaveSections, evenSections, nextSectionLabels, normalizeSections, sectionSeatSummary, seatSectionMap, tableColumns
} from '@/utils/sections'
import type { TableItem, TableSection } from '@/types'

interface SectionEditorProps {
  table: TableItem
  /** Versión compacta para el panel lateral. */
  compact?: boolean
}

/** Editor de submesas: tramos a lo largo de una mesa imperial, cada uno con su nº de mesa. */
export default function SectionEditor({ table, compact }: SectionEditorProps) {
  const scenario = useActiveScenario()
  const guests = useProjectStore((s) => s.project.guests)
  const updateTable = useProjectStore((s) => s.updateTable)
  const renumberSections = useProjectStore((s) => s.renumberSections)
  const cols = tableColumns(table)
  const [count, setCount] = useState(Math.min(5, Math.max(2, Math.round(cols / 6))))

  const sections = normalizeSections(table)
  const occupancy = useMemo(() => {
    const map = seatSectionMap(table)
    const occ = new Map<string, { seated: number; seats: number }>()
    map.forEach((r, seatIndex) => {
      const cur = occ.get(r.section.id) ?? { seated: 0, seats: 0 }
      cur.seats++
      if (guests.some((g) => g.tableId === table.id && g.seatIndex === seatIndex)) cur.seated++
      occ.set(r.section.id, cur)
    })
    return occ
  }, [table, guests])

  if (table.type !== 'rect') {
    return compact ? null : <p className="text-muted text-sm">Las submesas solo están disponibles en mesas rectangulares (imperiales).</p>
  }
  if (!canHaveSections(table)) {
    return <p className="text-muted text-sm">Añade al menos 2 asientos por lado para poder dividir la mesa.</p>
  }

  const save = (next: TableSection[]) => updateTable(table.id, { sections: next.length >= 2 ? next : undefined })

  const split = () => save(evenSections({ ...table, sections: undefined }, count, nextSectionLabels(scenario, count, table.id)))

  const changeSpan = (i: number, value: number) => {
    const next = sections.map((s) => ({ ...s }))
    const j = i < next.length - 1 ? i + 1 : i - 1 // el vecino que compensa
    const max = next[i].span + next[j].span - 1
    const v = Math.max(1, Math.min(max, Math.round(value)))
    next[j].span += next[i].span - v
    next[i].span = v
    save(next)
  }

  const remove = (i: number) => {
    const next = sections.map((s) => ({ ...s }))
    const j = i > 0 ? i - 1 : 1
    next[j].span += next[i].span
    next.splice(i, 1)
    save(next)
  }

  const add = () => {
    // parte en dos el tramo más largo
    const next = sections.map((s) => ({ ...s }))
    let k = 0
    next.forEach((s, i) => { if (s.span > next[k].span) k = i })
    if (next[k].span < 2) return
    const a = Math.ceil(next[k].span / 2)
    const added: TableSection = { id: createId('section'), label: nextSectionLabels(scenario, 1)[0], span: next[k].span - a }
    next[k].span = a
    next.splice(k + 1, 0, added)
    save(next)
  }

  if (!sections.length) {
    return (
      <div className="section-editor">
        <p className="text-muted text-sm">
          Divide la mesa en tramos a lo largo. Cada tramo tiene su propio nº de mesa y agrupa los asientos enfrentados de los dos lados.
        </p>
        <div className="input-row" style={{ marginTop: 6 }}>
          <NumberField value={count} min={2} max={cols} onCommit={(v) => setCount(Math.max(2, Math.min(cols, Math.round(v))))} />
          <button className="btn btn-secondary btn-sm" onClick={split}>✂ Dividir en {count} submesas</button>
        </div>
      </div>
    )
  }

  return (
    <div className="section-editor">
      <div className="section-head text-sm text-muted">
        <span>Nº / nombre</span>
        <span>Asientos por lado</span>
        <span>{compact ? '' : 'Asientos'}</span>
      </div>
      {sections.map((s, i) => {
        const occ = occupancy.get(s.id)
        return (
          <div key={s.id} className="section-row">
            <input
              className="input" value={s.label} aria-label="Número o nombre de la submesa"
              onChange={(e) => save(sections.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))}
            />
            <NumberField value={s.span} min={1} onCommit={(v) => changeSpan(i, v)} />
            <span className="text-sm text-soft section-seats" title={`Asientos ${sectionSeatSummary(table, s.id)}`}>
              {compact ? `${occ?.seated ?? 0}/${occ?.seats ?? 0}` : <>#{sectionSeatSummary(table, s.id)} · {occ?.seated ?? 0}/{occ?.seats ?? 0}</>}
            </span>
            <button className="btn-icon btn-ghost btn-sm" title="Unir con el tramo vecino" onClick={() => remove(i)}>✕</button>
          </div>
        )
      })}
      <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={add}>+ Tramo</button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => save(evenSections(table, sections.length, sections.map((s) => s.label)))}
          title="Mismo nº de asientos en cada tramo"
        >
          ⇹ Igualar
        </button>
        <button className="btn btn-secondary btn-sm" onClick={renumberSections} title="Numera 1…N todas las submesas de la sala, de izquierda a derecha">
          1…N Renumerar sala
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => save([])}>Quitar submesas</button>
      </div>
    </div>
  )
}
