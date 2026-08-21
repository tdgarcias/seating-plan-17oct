import { useEffect, useRef, useState } from 'react'

interface NumberFieldProps {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  placeholder?: string
}

/**
 * Input numérico "amigable": permite borrar el campo, dejarlo en blanco o en 0
 * mientras se escribe, y solo aplica el límite (min/max) al salir del campo
 * (blur) o pulsar Enter — nunca mientras el usuario está tecleando, para poder
 * borrar y volver a escribir sin que el valor salte al mínimo a cada tecla.
 */
export default function NumberField({ value, onCommit, min, max, step = 1, className, placeholder }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(String(value))
    }
  }, [value])

  const commit = () => {
    let parsed = parseFloat(text.replace(',', '.'))
    if (Number.isNaN(parsed)) parsed = min ?? 0
    if (min !== undefined) parsed = Math.max(min, parsed)
    if (max !== undefined) parsed = Math.min(max, parsed)
    setText(String(parsed))
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={className ?? 'input'}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value
        if (/^-?[0-9]*[.,]?[0-9]*$/.test(v)) setText(v)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      step={step}
    />
  )
}
