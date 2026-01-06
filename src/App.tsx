import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import SnippetOverlay from './components/SnippetOverlay'
import './App.css'

function App() {
  const [isOverlay, setIsOverlay] = useState(false)

  useEffect(() => {
    // Check initial hash or query
    if (window.location.hash.includes('overlay') || window.location.search.includes('overlay')) {
      setIsOverlay(true)
    }

    const handleHashChange = () => {
      if (window.location.hash.includes('overlay')) {
        setIsOverlay(true)
      } else {
        setIsOverlay(false)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <div className="app-container">
      {isOverlay ? <SnippetOverlay /> : <Toolbar />}
    </div>
  )
}

export default App
