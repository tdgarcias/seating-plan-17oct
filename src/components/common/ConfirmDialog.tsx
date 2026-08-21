import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  danger,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel} width={420}>
      <h2>{title}</h2>
      <p className="text-soft" style={{ marginTop: 10, lineHeight: 1.5 }}>{description}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
