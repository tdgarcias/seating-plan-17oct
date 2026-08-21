import { useEffect, useState } from 'react'
import Modal from '@/components/common/Modal'
import { useProjectStore, useActiveScenario } from '@/store/useProjectStore'
import { loadStoredApiKey, saveStoredApiKey, loadStoredModel, saveStoredModel, DEFAULT_AI_MODEL } from '@/services/aiAnalysisService'

interface AIAnalysisModalProps {
  onClose: () => void
}

export default function AIAnalysisModal({ onClose }: AIAnalysisModalProps) {
  const scenario = useActiveScenario()
  const status = useProjectStore((s) => s.ui.aiAnalysisStatus)
  const error = useProjectStore((s) => s.ui.aiAnalysisError)
  const result = useProjectStore((s) => s.ui.aiAnalysisResult)
  const runAIAnalysis = useProjectStore((s) => s.runAIAnalysis)

  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_AI_MODEL)
  const [showKeyField, setShowKeyField] = useState(false)

  useEffect(() => {
    setApiKey(loadStoredApiKey())
    setModel(loadStoredModel())
  }, [])

  const hasKey = apiKey.trim().length > 0
  const showingResult = result && result.scenarioId === scenario.id

  const handleAnalyze = () => {
    saveStoredApiKey(apiKey.trim())
    saveStoredModel(model.trim())
    runAIAnalysis(apiKey.trim(), model.trim() || DEFAULT_AI_MODEL)
  }

  return (
    <Modal onClose={onClose} width={560}>
      <h2>Análisis del seating con IA</h2>
      <p className="text-soft text-sm" style={{ marginTop: 6, lineHeight: 1.5 }}>
        Claude revisará las mesas, los roles de los invitados, quién son los novios y los elementos de la sala
        (DJ, baños, puertas...) para darte una valoración del escenario <strong>"{scenario.name}"</strong>.
      </p>

      {(!hasKey || showKeyField) && (
        <div className="ai-key-box">
          <div className="field">
            <label>Tu clave de API de Anthropic</label>
            <input
              type="password" className="input" value={apiKey} placeholder="sk-ant-…"
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>
              Se guarda solo en tu navegador (localStorage), nunca en el proyecto ni en el código.
              Consíguela en <span className="text-soft">console.anthropic.com/settings/keys</span>.
            </p>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Modelo</label>
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>
      )}

      {hasKey && !showKeyField && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setShowKeyField(true)}>
          Cambiar clave / modelo
        </button>
      )}

      {status === 'error' && error && (
        <div className="issue-row issue-error" style={{ marginTop: 14 }}>{error}</div>
      )}

      {showingResult && (
        <div className="ai-result">
          <div className="flex justify-between items-center">
            <span className="text-muted text-sm">
              Generado el {new Date(result!.createdAt).toLocaleString('es-ES')} · {result!.model}
            </span>
          </div>
          <div className="ai-result-content">
            {result!.content.split('\n').map((line, i) => (
              line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        <button className="btn btn-primary" onClick={handleAnalyze} disabled={status === 'loading' || !apiKey.trim()}>
          {status === 'loading' ? 'Analizando…' : showingResult ? 'Volver a analizar' : 'Analizar seating'}
        </button>
      </div>
    </Modal>
  )
}
