import { useState, useEffect } from 'react'
import { GripHorizontal, Circle, Scan, Settings, X, Save } from 'lucide-react'
import './Toolbar.css'

export default function Toolbar() {
    const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')
    const [showSettings, setShowSettings] = useState(false)
    const [modelId, setModelId] = useState('')
    const [systemPrompt, setSystemPrompt] = useState('')

    // Load settings
    useEffect(() => {
        const storedModel = localStorage.getItem('modelId') || 'gemini-3-flash'
        const storedPrompt = localStorage.getItem('systemPrompt') || 'Translate this text to Vietnamese.'
        setModelId(storedModel)
        setSystemPrompt(storedPrompt)

        // Poll server for status (optional, mock for now)
        const interval = setInterval(() => {
            // Implement health check here if needed
            // setStatus('connected') etc.
            // For now, assume connected if dark-server is running
            setStatus('connected')
        }, 2000)

        return () => clearInterval(interval)
    }, [])

    // Handle Resize
    useEffect(() => {
        if (showSettings) {
            window.ipcRenderer.send('resize-me', { width: 600, height: 450 })
        } else {
            window.ipcRenderer.send('resize-me', { width: 600, height: 80 })
        }
    }, [showSettings])

    const handleSave = () => {
        localStorage.setItem('modelId', modelId)
        localStorage.setItem('systemPrompt', systemPrompt)
        setShowSettings(false)
    }

    const handleScan = () => {
        window.ipcRenderer.send('start-scan')
    }

    const handleClose = () => {
        window.ipcRenderer.send('app-quit')
    }

    return (
        <div className="toolbar-container">
            {/* Navbar */}
            <div className="toolbar-nav drag-handle">
                <div className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <GripHorizontal className="text-gray-500" style={{ opacity: 0.5 }} />
                    <div className="status-indicator no-drag" title={status === 'connected' ? "Connected" : "Disconnected"}>
                        <Circle size={10} fill={status === 'connected' ? '#22c55e' : '#ef4444'} stroke="none" />
                        <span className="status-text">
                            {status === 'connected' ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center no-drag" style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={handleScan} className="scan-btn">
                        <Scan size={18} />
                        SCAN
                    </button>

                    <div style={{ width: 10 }} />

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`icon-btn ${showSettings ? 'active' : ''}`}
                    >
                        <Settings size={20} />
                    </button>

                    <div className="separator"></div>

                    <button onClick={handleClose} className="icon-btn btn-danger">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="settings-panel no-drag">
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#ddd' }}>
                        <Settings size={18} /> Configuration
                    </h3>

                    <div className="form-group">
                        <label className="form-label">Model ID</label>
                        <select
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            className="form-input"
                        >
                            <option value="gemini-3-flash">gemini-3-flash</option>
                            <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">System Prompt</label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="form-input form-textarea"
                            placeholder="Enter system prompt instructions..."
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleSave} className="save-btn">
                            <Save size={16} /> Save Settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
