import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import SnippetOverlay from './components/SnippetOverlay'
import './App.css'

function App() {
  const [route, setRoute] = useState<'toolbar' | 'overlay'>('toolbar')

  useEffect(() => {
    // Determine route based on hash
    const determineRoute = () => {
      const hash = window.location.hash
      if (hash.includes('overlay')) {
        setRoute('overlay')
      } else {
        setRoute('toolbar')
      }
    }

    determineRoute()

    window.addEventListener('hashchange', determineRoute)
    return () => window.removeEventListener('hashchange', determineRoute)
  }, [])

  return (
    <div className="app-container">
      {route === 'overlay' ? <SnippetOverlay /> : <Toolbar />}
    </div>
  )
}

export default App
