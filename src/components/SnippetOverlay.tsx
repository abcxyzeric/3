import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import './SnippetOverlay.css'

export default function SnippetOverlay() {
    const [bgImage, setBgImage] = useState<string | null>(null)
    const [isSelecting, setIsSelecting] = useState(false)
    const [startPos, setStartPos] = useState({ x: 0, y: 0 })
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
    const [step, setStep] = useState<'waiting' | 'ready' | 'selecting' | 'processing'>('waiting')

    useEffect(() => {
        // Listen for screen capture from Main Process
        window.ipcRenderer.on('screen-captured', (_event: any, imageData: string) => {
            setBgImage(imageData)
            setStep('ready')
        })

        // Escape to cancel
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                window.ipcRenderer.send('hide-overlay')
            }
        }
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    // Mouse Events for Selection
    const handleMouseDown = (e: React.MouseEvent) => {
        if (step !== 'ready') return
        setIsSelecting(true)
        setStep('selecting')
        setStartPos({ x: e.clientX, y: e.clientY })
        setCurrentPos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (step === 'selecting' && isSelecting) {
            setCurrentPos({ x: e.clientX, y: e.clientY })
        }
    }

    const handleMouseUp = async () => {
        if (step === 'selecting' && isSelecting) {
            setIsSelecting(false)
            const w = Math.abs(currentPos.x - startPos.x)
            const h = Math.abs(currentPos.y - startPos.y)

            if (w > 10 && h > 10) {
                const x = Math.min(startPos.x, currentPos.x)
                const y = Math.min(startPos.y, currentPos.y)
                await processSelection(x, y, w, h)
            } else {
                // Selection too small, reset
                setStep('ready')
            }
        }
    }

    const processSelection = async (x: number, y: number, w: number, h: number) => {
        setStep('processing')

        if (!bgImage) return

        // Crop Image
        const canvas = document.createElement('canvas')
        const scale = window.devicePixelRatio
        canvas.width = w * scale
        canvas.height = h * scale
        const ctx = canvas.getContext('2d')

        const img = new Image()
        img.src = bgImage
        img.onload = async () => {
            if (!ctx) return

            ctx.drawImage(img, x * scale, y * scale, w * scale, h * scale, 0, 0, w * scale, h * scale)
            const base64 = canvas.toDataURL('image/jpeg', 0.85)

            // Send to Server
            try {
                const modelId = localStorage.getItem('modelId') || 'gemini-3-flash'
                const prompt = localStorage.getItem('systemPrompt') || 'Translate this text to Vietnamese.'

                const response = await fetch('http://localhost:8889/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: base64,
                        modelId,
                        prompt,
                        apiKey: import.meta.env.VITE_GOOGLE_API_KEY
                    })
                })

                const data = await response.json()
                const resultText = data.text || data.result || 'No result.'

                // Send result to Main -> Toolbar
                window.ipcRenderer.send('translation-result', resultText)

                // Hide overlay
                window.ipcRenderer.send('hide-overlay')

            } catch (err) {
                console.error(err)
                window.ipcRenderer.send('translation-result', 'Error: Could not connect to server.')
                window.ipcRenderer.send('hide-overlay')
            }
        }
    }

    // Selection Box Coordinates
    const left = Math.min(startPos.x, currentPos.x)
    const top = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)

    return (
        <div
            className="overlay-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Background Screenshot */}
            {bgImage && (
                <img src={bgImage} className="overlay-bg" alt="" draggable={false} />
            )}

            {/* Dark Overlay */}
            <div className="overlay-dim" />

            {/* Selection Box */}
            {step === 'selecting' && (
                <div
                    className="selection-box"
                    style={{ left, top, width, height }}
                />
            )}

            {/* Loading Indicator */}
            {step === 'processing' && (
                <div className="loading-indicator">
                    <Loader2 className="spinner" size={20} />
                    <span>Translating...</span>
                </div>
            )}

            {/* Instruction */}
            {step === 'ready' && (
                <div className="instruction-text">
                    Drag to select area • Press ESC to cancel
                </div>
            )}
        </div>
    )
}
