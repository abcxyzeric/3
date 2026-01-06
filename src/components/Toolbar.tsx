import { useState, useEffect } from 'react'
import { GripHorizontal, Scan, Settings, X, Save, ToggleLeft, ToggleRight, MessageSquare, Layers } from 'lucide-react'
import './Toolbar.css'

const AVAILABLE_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' }
]

type DisplayMode = 'chatbox' | 'overlay'

export default function Toolbar() {
    const [showSettings, setShowSettings] = useState(false)
    const [modelId, setModelId] = useState('gemini-3-flash-preview')
    const [systemPrompt, setSystemPrompt] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [displayMode, setDisplayMode] = useState<DisplayMode>('chatbox')

    // Load settings
    useEffect(() => {
        const storedModel = localStorage.getItem('modelId') || 'gemini-3-flash-preview'
        const storedPrompt = localStorage.getItem('systemPrompt') || 'Translate this text to Vietnamese.'
        const storedApiKey = localStorage.getItem('geminiApiKey') || ''
        const storedMode = (localStorage.getItem('displayMode') as DisplayMode) || 'chatbox'
        setModelId(storedModel)
        setSystemPrompt(storedPrompt)
        setApiKey(storedApiKey)
        setDisplayMode(storedMode)

        // Notify main process of current mode
        window.ipcRenderer.send('set-mode', storedMode)
    }, [])

    // Handle Toolbar Resize for Settings Panel
    useEffect(() => {
        if (showSettings) {
            window.ipcRenderer.send('resize-commander', { width: 420, height: 380 })
        } else {
            window.ipcRenderer.send('resize-commander', { width: 420, height: 60 })
        }
    }, [showSettings])

    const handleSave = () => {
        localStorage.setItem('modelId', modelId)
        localStorage.setItem('systemPrompt', systemPrompt)
        localStorage.setItem('geminiApiKey', apiKey)
        localStorage.setItem('displayMode', displayMode)
        window.ipcRenderer.send('set-mode', displayMode)
        setShowSettings(false)
    }

    const handleScan = () => {
        window.ipcRenderer.send('trigger-scan')
    }

    const handleClose = () => {
        window.ipcRenderer.send('app-quit')
    }

    const toggleMode = () => {
        const newMode: DisplayMode = displayMode === 'chatbox' ? 'overlay' : 'chatbox'
        setDisplayMode(newMode)
        localStorage.setItem('displayMode', newMode)
        window.ipcRenderer.send('set-mode', newMode)
    }

    return (
        <div className="toolbar-container">
            {/* Main Nav Bar */}
            <div className="toolbar-nav drag-handle">
                <div className="nav-left no-drag">
                    <GripHorizontal size={16} className="grip-icon" />

                    {/* Mode Toggle */}
                    <button onClick={toggleMode} className="mode-toggle" title={`Mode: ${displayMode === 'chatbox' ? 'Chatbox' : 'Overlay'} `}>
                        {displayMode === 'chatbox' ? (
                            <>
                                <MessageSquare size={14} />
                                <span>Chat</span>
                            </>
                        ) : (
                            <>
                                <Layers size={14} />
                                <span>Patch</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="nav-right no-drag">
                    <button onClick={handleScan} className="scan-btn">
                        <Scan size={14} />
                        SCAN
                    </button>

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`icon - btn ${showSettings ? 'active' : ''} `}
                    >
                        <Settings size={16} />
                    </button>

                    <div className="separator" />

                    <button onClick={handleClose} className="icon-btn btn-danger">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="settings-panel">
                    <div className="form-group">
                        <label className="form-label">API Key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="form-input"
                            placeholder="Enter your Gemini API Key..."
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Model</label>
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
