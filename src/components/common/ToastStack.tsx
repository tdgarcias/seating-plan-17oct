import { useProjectStore } from '@/store/useProjectStore'

export default function ToastStack() {
  const toasts = useProjectStore((s) => s.ui.toasts)
  const dismissToast = useProjectStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type === 'success' ? 'toast-success' : t.type === 'error' ? 'toast-error' : ''}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
