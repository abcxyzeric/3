import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Toolbar from './components/Toolbar'
import ChatboxPanel from './components/ChatboxPanel'
import DirectOverlay from './components/DirectOverlay'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Toolbar />} />
        <Route path="/chat" element={<ChatboxPanel />} />
        <Route path="/overlay" element={<DirectOverlay />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
