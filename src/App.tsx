import { useEffect } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import Header from '@/components/layout/Header'
import EditorPage from '@/pages/EditorPage'
import ToastStack from '@/components/common/ToastStack'
import Onboarding from '@/components/onboarding/Onboarding'

export default function App() {
  const init = useProjectStore((s) => s.init)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const hasSeenOnboarding = useProjectStore((s) => s.ui.hasSeenOnboarding)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return (
    <div className="app-shell">
      <Header />
      <EditorPage />
      <ToastStack />
      {!hasSeenOnboarding && <Onboarding />}
    </div>
  )
}
