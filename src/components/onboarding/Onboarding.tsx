import Modal from '@/components/common/Modal'
import { useProjectStore } from '@/store/useProjectStore'

const STEPS = [
  ['1', 'Define las dimensiones de tu sala', 'Ajusta la anchura y longitud reales en el panel derecho.'],
  ['2', 'Importa a tus invitados', 'Desde el panel izquierdo, actualiza desde Google Sheets o carga datos de ejemplo.'],
  ['3', 'Añade mesas', 'Crea mesas redondas o rectangulares y colócalas arrastrándolas.'],
  ['4', 'Asigna invitados', 'Arrastra cada invitado hasta su mesa o asiento, o selecciona varios a la vez.'],
  ['5', 'Revisa y exporta', 'Comprueba los avisos, guarda escenarios alternativos y exporta tu plano final.']
] as const

export default function Onboarding() {
  const dismissOnboarding = useProjectStore((s) => s.dismissOnboarding)

  return (
    <Modal onClose={dismissOnboarding} width={520}>
      <h2>Bienvenido a tu seating plan</h2>
      <p className="text-soft" style={{ marginTop: 6, lineHeight: 1.5 }}>
        Una herramienta visual para organizar la distribución de tu boda en Mallorca, mesa a mesa.
      </p>
      <div className="onboarding-steps">
        {STEPS.map(([n, title, desc]) => (
          <div key={n} className="onboarding-step">
            <span className="onboarding-step-num">{n}</span>
            <div>
              <strong>{title}</strong>
              <p className="text-soft text-sm">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={dismissOnboarding}>Empezar</button>
      </div>
    </Modal>
  )
}
