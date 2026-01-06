import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import './DirectOverlay.css'

interface Patch {
    id: number
    x: number
    y: number
    w: number
    h: number
    text: string
}

export default function DirectOverlay() {
    const [bgImage, setBgImage] = useState<string | null>(null)
    const [isSelecting, setIsSelecting] = useState(false)
    const [startPos, setStartPos] = useState({ x: 0, y: 0 })
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
    const [step, setStep] = useState<'idle' | 'ready' | 'selecting' | 'processing'>('idle')
    const [patches, setPatches] = useState<Patch[]>([])

    useEffect(() => {
        // Listen for screen capture
        window.ipcRenderer.on('screen-captured', (_event: any, imageData: string) => {
            setBgImage(imageData)
            setStep('ready')
        })

        // Listen for patch data (in-place translation)
        window.ipcRenderer.on('show-patch', (_event: any, data: { text: string; rect: { x: number; y: number; w: number; h: number } }) => {
            if (data.rect) {
                const newPatch: Patch = {
                    id: Date.now(),
                    x: data.rect.x,
                    y: data.rect.y,
                    w: data.rect.w,
                    h: data.rect.h,
                    text: data.text
                }
                setPatches(prev => [...prev, newPatch])
            }
            setStep('idle')
            setBgImage(null)
        })

        // Listen for clear patches
        window.ipcRenderer.on('clear-patches', () => {
            setPatches([])
        })

        // Escape to cancel
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setStep('idle')
                setBgImage(null)
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
            const base64Data = base64.split(',')[1]

            try {
                const modelId = localStorage.getItem('modelId') || 'gemini-3-flash-preview'

                // Construct strict prompt
                const userPrompt = localStorage.getItem('systemPrompt') || 'Translate this text to Vietnamese.'
                const strictInstruction = "IMPORTANT: Output ONLY the translated text. Do NOT include introductory phrases like 'Here is the translation', 'Below is...', or quotes. Do NOT explain. Just output the translation."
                const finalPrompt = `${userPrompt}\n\n${strictInstruction}`

                const apiKey = localStorage.getItem('geminiApiKey') || ''

                const url = `http://localhost:8889/v1beta/models/${modelId}:generateContent?key=${apiKey}`

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: finalPrompt },
                                { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
                            ]
                        }]
                    })
                })

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`)
                }

                const data = await response.json()
                let resultText = 'No result.'
                if (data.candidates?.[0]?.content?.parts) {
                    resultText = data.candidates[0].content.parts[0].text
                }

                // Send result with coordinates to Main
                window.ipcRenderer.send('translation-result', { text: resultText, rect: { x, y, w, h } })

            } catch (err: any) {
                console.error(err)
                window.ipcRenderer.send('translation-result', { text: `Error: ${err.message}`, rect: { x, y, w, h } })
            }
        }
    }

    // Selection Box
    const left = Math.min(startPos.x, currentPos.x)
    const top = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)

    return (
        <div
            className={`overlay-container ${step === 'idle' && patches.length === 0 ? 'pointer-none' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Background Screenshot (only during selection) */}
            {bgImage && (
                <>
                    <img src={bgImage} className="overlay-bg" alt="" draggable={false} />
                    <div className="overlay-dim" />
                </>
            )}

            {/* Selection Box */}
            {step === 'selecting' && (
                <div className="selection-box" style={{ left, top, width, height }} />
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

            {/* Rendered Patches (Game Patch Effect) */}
            {patches.map((patch) => {
                // Simple heuristic for font sizing based on box height
                // Minimum 12px, Max 24px. Adjust based on height.
                const dynamicFontSize = Math.max(12, Math.min(20, patch.h * 0.55))

                return (
                    <div
                        key={patch.id}
                        className="patch-box"
                        style={{
                            left: patch.x,
                            top: patch.y,
                            width: patch.w,
                            height: patch.h, // Enforce strict height match
                            fontSize: `${dynamicFontSize}px`
                        }}
                    >
                        {patch.text}
                    </div>
                )
            })}
        </div>
    )
}
