import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, MousePointer2, Trash2 } from 'lucide-react'
import './ChatboxPanel.css'

interface Message {
    id: number
    text: string
    timestamp: Date
}

export default function ChatboxPanel() {
    const [messages, setMessages] = useState<Message[]>([])
    const [clickThrough, setClickThrough] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Listen for new translation messages from Main Process
        window.ipcRenderer.on('new-message', (_event: any, text: string) => {
            const newMsg: Message = {
                id: Date.now(),
                text,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, newMsg])
        })

        return () => {
            // Cleanup if needed
        }
    }, [])

    // Auto-scroll to bottom when new message arrives
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const toggleClickThrough = () => {
        const newState = !clickThrough
        setClickThrough(newState)
        window.ipcRenderer.send('toggle-chat-clickthrough', newState)
    }

    const clearMessages = () => {
        setMessages([])
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="chatbox-container">
            {/* Header */}
            <div className="chatbox-header drag-handle">
                <div className="header-left">
                    <MessageSquare size={14} />
                    <span className="header-title">Translations</span>
                    <span className="message-count">{messages.length}</span>
                </div>
                <div className="header-right no-drag">
                    <button
                        className={`icon-btn-xs ${clickThrough ? 'active' : ''}`}
                        onClick={toggleClickThrough}
                        title="Click-through mode"
                    >
                        <MousePointer2 size={12} />
                    </button>
                    <button
                        className="icon-btn-xs"
                        onClick={clearMessages}
                        title="Clear all"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="chatbox-messages">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <MessageSquare size={32} strokeWidth={1} />
                        <p>Translations will appear here</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="message-item">
                            <div className="message-time">{formatTime(msg.timestamp)}</div>
                            <div className="message-text">{msg.text}</div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    )
}
