import { useProjectStore } from '@/store/useProjectStore'
import GuestList from '@/components/guests/GuestList'
import RoomCanvas from '@/components/room/RoomCanvas'
import PropertiesPanel from '@/components/tables/PropertiesPanel'
import TablesBoard from '@/components/tables/TablesBoard'
import PresentationView from '@/components/presentation/PresentationView'

export default function EditorPage() {
  const viewMode = useProjectStore((s) => s.ui.viewMode)

  if (viewMode === 'presentacion') {
    return <PresentationView />
  }

  if (viewMode === 'organizar') {
    return (
      <div className="app-body">
        <GuestList />
        <main className="app-main organize-main">
          <div className="organize-main-header">
            <h3>Mesas</h3>
            <p className="text-soft text-sm">Arrastra invitados desde la izquierda hasta la mesa deseada.</p>
          </div>
          <TablesBoard />
        </main>
      </div>
    )
  }

  return (
    <div className="app-body">
      <GuestList />
      <main className="app-main">
        <RoomCanvas />
      </main>
      <PropertiesPanel />
    </div>
  )
}
