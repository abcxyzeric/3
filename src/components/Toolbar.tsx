import { useState, useEffect } from 'react'
import { GripHorizontal, Circle, Scan, Settings, X, Save, Copy, ChevronDown } from 'lucide-react'
import './Toolbar.css'

const AVAILABLE_MODELS = [
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' }
]

export default function Toolbar() {
    const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')
    const [showSettings, setShowSettings] = useState(false)
    const [modelId, setModelId] = useState('gemini-3-flash')
    const [systemPrompt, setSystemPrompt] = useState('')
    const [translationResult, setTranslationResult] = useState<string | null>(null)

    // Load settings & listen for translation results
    useEffect(() => {
        const storedModel = localStorage.getItem('modelId') || 'gemini-3-flash'
        const storedPrompt = localStorage.getItem('systemPrompt') || 'Translate this text to Vietnamese.'
        setModelId(storedModel)
        setSystemPrompt(storedPrompt)

        // Status check (mock - assume connected if server running)
        const interval = setInterval(() => {
            setStatus('connected')
        }, 2000)

        // Listen for translation result from Main Process
        window.ipcRenderer.on('translation-result', (_event: any, result: string) => {
            setTranslationResult(result)
        })

        return () => {
            clearInterval(interval)
            // Note: Ideally remove listener too, but for simplicity...
        }
    }, [])

    // Handle Toolbar Resize for Settings Panel
    useEffect(() => {
        if (showSettings) {
            window.ipcRenderer.send('resize-toolbar', { width: 500, height: 400 })
        } else if (translationResult) {
            window.ipcRenderer.send('resize-toolbar', { width: 500, height: 250 })
        } else {
            window.ipcRenderer.send('resize-toolbar', { width: 500, height: 70 })
        }
    }, [showSettings, translationResult])

    const handleSave = () => {
        localStorage.setItem('modelId', modelId)
        localStorage.setItem('systemPrompt', systemPrompt)
        setShowSettings(false)
    }

    const handleScan = () => {
        setTranslationResult(null) // Clear previous result
        window.ipcRenderer.send('trigger-scan')
    }

    const handleClose = () => {
        window.ipcRenderer.send('app-quit')
    }

    const copyResult = () => {
        if (translationResult) {
            navigator.clipboard.writeText(translationResult)
        }
    }

    const clearResult = () => {
        setTranslationResult(null)
    }

    return (
        <div className="toolbar-container">
            {/* Main Nav Bar */}
            <div className="toolbar-nav drag-handle">
                <div className="nav-left no-drag">
                    <GripHorizontal size={18} style={{ opacity: 0.4, marginRight: 8 }} />
                    <div className="status-indicator" title={status === 'connected' ? 'Connected' : 'Disconnected'}>
                        <Circle size={8} fill={status === 'connected' ? '#22c55e' : '#ef4444'} stroke="none" />
                        <span className="status-text">{status === 'connected' ? 'ONLINE' : 'OFFLINE'}</span>
                    </div>
                </div>

                <div className="nav-right no-drag">
                    <button onClick={handleScan} className="scan-btn">
                        <Scan size={16} />
                        SCAN
                    </button>

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`icon-btn ${showSettings ? 'active' : ''}`}
                    >
                        <Settings size={18} />
                    </button>

                    <div className="separator" />

                    <button onClick={handleClose} className="icon-btn btn-danger">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Translation Result Panel */}
            {translationResult && !showSettings && (
                <div className="result-panel">
                    <div className="result-header">
                        <span className="result-title">Translation Result</span>
                        <div className="result-actions">
                            <button className="icon-btn-sm" onClick={copyResult} title="Copy">
                                <Copy size={14} />
                            </button>
                            <button className="icon-btn-sm" onClick={clearResult} title="Clear">
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="result-content">
                        {translationResult}
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className="settings-panel">
                    <h3 className="settings-title">
                        <Settings size={16} /> Configuration
                    </h3>

                    <div className="form-group">
                        <label className="form-label">Model</label>
                        <div className="select-wrapper">
                            <select
                                value={modelId}
                                onChange={(e) => setModelId(e.target.value)}
                                className="form-select"
                            >
                                {AVAILABLE_MODELS.map((model) => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="select-icon" />
                        </div>
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">System Prompt</label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="form-textarea"
                            placeholder="Enter instructions for the AI..."
                        />
                    </div>

                    <div className="settings-footer">
                        <button onClick={handleSave} className="save-btn">
                            <Save size={14} /> Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
