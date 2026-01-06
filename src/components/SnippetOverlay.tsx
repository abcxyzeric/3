import { useState, useEffect, useRef } from 'react'
import { X, Copy, Loader2, Move } from 'lucide-react'
import './SnippetOverlay.css'

export default function SnippetOverlay() {
    const [bgImage, setBgImage] = useState<string | null>(null)
    const [isSelecting, setIsSelecting] = useState(false)
    const [startPos, setStartPos] = useState({ x: 0, y: 0 })
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
    const [step, setStep] = useState<'idle' | 'capturing' | 'processing' | 'result'>('idle')
    const [resultText, setResultText] = useState('')
    const [resultPos, setResultPos] = useState({ x: 100, y: 100 })

    // Draggable Result Box State
    const [isDraggingResult, setIsDraggingResult] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    useEffect(() => {
        // Escape key to cancel
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                window.ipcRenderer.send('close-overlay')
            }
        }
        window.addEventListener('keydown', handleKeyDown)

        // Capture screen
        const init = async () => {
            try {
                const image = await window.ipcRenderer.invoke('get-screen-image')
                setBgImage(image)
                setStep('capturing')
            } catch (err) {
                console.error('Failed to capture screen:', err)
                // Fallback or close
                window.ipcRenderer.send('close-overlay')
            }
        }
        init()

        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Selection Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (step !== 'capturing') return
        setIsSelecting(true)
        setStartPos({ x: e.clientX, y: e.clientY })
        setCurrentPos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (step === 'capturing' && isSelecting) {
            setCurrentPos({ x: e.clientX, y: e.clientY })
        }

        // Handle Result Box Dragging
        if (isDraggingResult) {
            setResultPos({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            })
        }
    }

    const handleMouseUp = async () => {
        if (step === 'capturing' && isSelecting) {
            setIsSelecting(false)
            const w = Math.abs(currentPos.x - startPos.x)
            const h = Math.abs(currentPos.y - startPos.y)

            if (w > 10 && h > 10) {
                // Valid selection
                const x = Math.min(startPos.x, currentPos.x)
                const y = Math.min(startPos.y, currentPos.y)

                await processSelection(x, y, w, h)
            } else {
                // Too small, reset
            }
        }

        setIsDraggingResult(false)
    }

    const processSelection = async (x: number, y: number, w: number, h: number) => {
        setStep('processing')
        setResultPos({ x, y: y + h + 10 }) // Show loader near selection

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

            // Draw cropped area
            ctx.drawImage(img, x * scale, y * scale, w * scale, h * scale, 0, 0, w * scale, h * scale)
            const base64 = canvas.toDataURL('image/jpeg', 0.8) // optimize size

            // Fetch Translation
            try {
                const modelId = localStorage.getItem('modelId') || 'gemini-3-flash'
                const prompt = localStorage.getItem('systemPrompt') || 'Translate this to Vietnamese'

                // Send to Server
                const response = await fetch('http://localhost:8889/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: base64,
                        modelId,
                        prompt
                    })
                })

                const data = await response.json()
                setResultText(data.text || data.result || 'No result found.')
                setStep('result')

            } catch (err) {
                console.error(err)
                setResultText('Error connecting to server. Is dark-server.js running?')
                setStep('result')
            }
        }
    }

    // Result Box Dragging
    const startDragResult = (e: React.MouseEvent) => {
        setIsDraggingResult(true)
        setDragOffset({
            x: e.clientX - resultPos.x,
            y: e.clientY - resultPos.y
        })
        e.stopPropagation()
    }

    if (step === 'idle') return null

    // Selection Rect
    const left = Math.min(startPos.x, currentPos.x)
    const top = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)

    return (
        <div
            className="overlay-container"
            style={{ background: step === 'capturing' ? 'none' : 'rgba(0,0,0,0.1)' }} // Show slight dim if not capturing
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Background Frozen Screen (Only invisible during result phase if desired, but user wants 'movable popup on screen'. keeping it visible/dimmed is better context) */}
            {/* Actually, if we keep it visible, user can't click things behind it. 
          If step === 'result', user might want to click BEHIND to close? 
          Or interact with app?
          Design: Transparent click-through? We can't do click-through partially easily.
          We will keep the overlay opaque captures for now.
      */}
            {step === 'capturing' && bgImage && (
                <img src={bgImage} className="overlay-bg" alt="" draggable={false} style={{ opacity: 0.5 }} />
            )}

            {/* Selection Box */}
            {step === 'capturing' && isSelecting && (
                <div
                    className="selection-box"
                    style={{ left, top, width, height }}
                />
            )}

            {/* Loading */}
            {step === 'processing' && (
                <div className="loading-pill" style={{ left: resultPos.x, top: resultPos.y }}>
                    <Loader2 className="animate-spin" size={16} /> Translating...
                </div>
            )}

            {/* Result Box */}
            {step === 'result' && (
                <div
                    className="result-box"
                    style={{ left: resultPos.x, top: resultPos.y }}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent selecting behind
                >
                    <div className="result-header" onMouseDown={startDragResult}>
                        <div className="flex items-center gap-2">
                            <Move size={14} className="text-gray-400" />
                            <span className="text-xs font-bold uppercase text-gray-400">Translation</span>
                        </div>
                        <div className="flex gap-2">
                            <button className="icon-btn" onClick={() => navigator.clipboard.writeText(resultText)}>
                                <Copy size={14} />
                            </button>
                            <button className="icon-btn text-red-500" onClick={() => window.ipcRenderer.send('close-overlay')}>
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {resultText}
                    </div>
                </div>
            )}
        </div>
    )
}
