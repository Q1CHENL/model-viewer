import { useEffect, useRef, useState } from 'react'
import { Viewer } from './viewer/Viewer'
import { installClippingUI } from './clipping'
import { installEdgesUI } from './edges'
import { installHighlightUI } from './highlight'
import Toolbar from './components/Toolbar'
import InfoPanel from './components/InfoPanel'
import StatsPanel from './components/StatsPanel'
import EdgesBanner from './components/EdgesBanner'

export interface ViewerStats {
  originalMeshes: number;
  batches: number;
  uniqueMaterials: number;
  unbatchedOriginals: number;
}

export interface SelectionInfo {
  name: string;
  type: string;
  verts: string;
  tris: string;
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [stats, setStats] = useState<ViewerStats>({
    originalMeshes: 0,
    batches: 0,
    uniqueMaterials: 0,
    unbatchedOriginals: 0
  })
  
  const [selection] = useState<SelectionInfo>({
    name: '-',
    type: '-',
    verts: '-',
    tris: '-'
  })
  
  const [loadTime, setLoadTime] = useState<string>('N/A')
  const [edgesTime, setEdgesTime] = useState<string>('N/A')
  const [highlightedCount, setHighlightedCount] = useState<number>(0)
  const [showEdgesBanner, setShowEdgesBanner] = useState<boolean>(false)
  const [batchDetails, setBatchDetails] = useState<{ originalCount: number }[]>([])
  const [showBatchDetails, setShowBatchDetails] = useState<boolean>(false)
  
  // Control states
  const [edgesEnabled, setEdgesEnabled] = useState<boolean>(false)
  const [adaptiveEnabled, setAdaptiveEnabled] = useState<boolean>(false)
  const [batchingEnabled, setBatchingEnabled] = useState<boolean>(true)
  const [cullingEnabled, setCullingEnabled] = useState<boolean>(true)
  const [cullThreshold, setCullThreshold] = useState<number>(50)
  const [maxBatchVertices, setMaxBatchVertices] = useState<number>(20000)
  const [dragSmooth, setDragSmooth] = useState<number>(0.05)
  const [zoomSpeed, setZoomSpeed] = useState<number>(0.5)
  const [searchText, setSearchText] = useState<string>('ab')
  const [highlightActive, setHighlightActive] = useState<boolean>(false)
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false)

  const updateStats = () => {
    if (!viewerRef.current) return
    const s = viewerRef.current.getStats()
    setStats(s)
    setHighlightedCount(viewerRef.current.getHighlightedCount())
  }

  const refreshBatchDetailsIfOpen = () => {
    if (!showBatchDetails || !viewerRef.current) return
    setBatchDetails(viewerRef.current.getBatchDetails())
  }

  useEffect(() => {
    if (!containerRef.current) return

    const viewer = new Viewer(containerRef.current)
    viewerRef.current = viewer

    // Install UI controllers (these still use DOM manipulation for now)
    installClippingUI(viewer)
    installEdgesUI(viewer)
    installHighlightUI(viewer.getHighlightController())

    updateStats()

    // Event listeners for viewer events
    const handleModelLoaded = () => {
      updateStats()
      refreshBatchDetailsIfOpen()
    }

    const handleEdgesBuilt = (e: any) => {
      const ms = e?.detail?.ms as number | undefined
      if (typeof ms === 'number') {
        setEdgesTime((ms / 1000).toFixed(2))
      }
      setShowEdgesBanner(false)
    }

    const handleHighlightChanged = () => {
      updateStats()
    }

    window.addEventListener('viewer:modelLoaded', handleModelLoaded)
    window.addEventListener('viewer:edgesBuilt', handleEdgesBuilt)
    window.addEventListener('viewer:highlightChanged', handleHighlightChanged)

    return () => {
      window.removeEventListener('viewer:modelLoaded', handleModelLoaded)
      window.removeEventListener('viewer:edgesBuilt', handleEdgesBuilt)
      window.removeEventListener('viewer:highlightChanged', handleHighlightChanged)
      viewer.dispose()
    }
  }, [])

  const handleFileOpen = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !viewerRef.current) return

    // Reset edges for new model
    setEdgesEnabled(false)
    viewerRef.current.setEdgesEnabled(false)
    setShowEdgesBanner(false)
    setEdgesTime('N/A')

    const t0 = performance.now()
    await viewerRef.current.loadGLBFromFile(file)
    const t1 = performance.now()
    setLoadTime(((t1 - t0) / 1000).toFixed(2))
    
    updateStats()
    refreshBatchDetailsIfOpen()
    
    window.dispatchEvent(new CustomEvent('viewer:modelLoaded'))
  }

  const handleEdgesToggle = () => {
    if (!viewerRef.current) return
    
    const nextEnabled = !edgesEnabled
    setEdgesEnabled(nextEnabled)
    
    if (nextEnabled) {
      if (!viewerRef.current.hasBuiltEdges()) {
        setShowEdgesBanner(true)
      }
      // Use requestAnimationFrame to ensure UI updates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          viewerRef.current?.setEdgesEnabled(true)
        })
      })
    } else {
      viewerRef.current.setEdgesEnabled(false)
    }
  }

  const handleAdaptiveToggle = () => {
    if (!viewerRef.current) return
    const next = !adaptiveEnabled
    setAdaptiveEnabled(next)
    viewerRef.current.setAdaptiveEnabled(next)
    updateStats()
  }

  const handleBatchingToggle = () => {
    if (!viewerRef.current) return
    const next = !batchingEnabled
    setBatchingEnabled(next)
    viewerRef.current.setBatchingEnabled(next)
    updateStats()
    refreshBatchDetailsIfOpen()
  }

  const handleCullingToggle = () => {
    if (!viewerRef.current) return
    const next = !cullingEnabled
    setCullingEnabled(next)
    viewerRef.current.setCullingEnabled(next)
    updateStats()
  }

  const handleCullThresholdChange = (value: number) => {
    setCullThreshold(value)
    if (viewerRef.current) {
      viewerRef.current.setCullingThreshold(value)
      updateStats()
    }
  }

  const handleMaxBatchVerticesChange = (value: number) => {
    setMaxBatchVertices(value)
    if (viewerRef.current) {
      viewerRef.current.setMaxVerticesPerBatch(value)
      viewerRef.current.rebuildBatching()
      updateStats()
      refreshBatchDetailsIfOpen()
    }
  }

  const handleDragSmoothChange = (value: number) => {
    setDragSmooth(value)
    if (viewerRef.current) {
      viewerRef.current.setDraggingSmoothTime(Math.min(value, 0.5))
    }
  }

  const handleZoomSpeedChange = (value: number) => {
    setZoomSpeed(value)
    if (viewerRef.current) {
      viewerRef.current.setZoomSpeed(value)
    }
  }

  const handleHighlightToggle = () => {
    if (!viewerRef.current) return
    
    const highlightController = viewerRef.current.getHighlightController()
    const isActive = highlightController.isTextHighlightActive()
    
    if (!isActive) {
      setShowSearchInput(true)
      if (searchText.trim()) {
        highlightController.highlightTextMeshes(true, searchText)
        setHighlightActive(true)
      }
    } else {
      highlightController.highlightTextMeshes(false, '')
      setHighlightActive(false)
      setShowSearchInput(false)
    }
  }

  const handleSearchTextChange = (text: string) => {
    setSearchText(text)
  }

  const handleSearchSubmit = () => {
    if (!viewerRef.current || !searchText.trim()) return
    
    const highlightController = viewerRef.current.getHighlightController()
    highlightController.highlightTextMeshes(true, searchText)
    setHighlightActive(true)
  }

  const handleBatchDetailsToggle = () => {
    const nextShow = !showBatchDetails
    setShowBatchDetails(nextShow)
    if (nextShow) {
      refreshBatchDetailsIfOpen()
    }
  }

  return (
    <div className="h-full w-full relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <EdgesBanner show={showEdgesBanner} />
      
      <Toolbar
        onFileOpen={handleFileOpen}
        edgesEnabled={edgesEnabled}
        onEdgesToggle={handleEdgesToggle}
        adaptiveEnabled={adaptiveEnabled}
        onAdaptiveToggle={handleAdaptiveToggle}
        batchingEnabled={batchingEnabled}
        onBatchingToggle={handleBatchingToggle}
        maxBatchVertices={maxBatchVertices}
        onMaxBatchVerticesChange={handleMaxBatchVerticesChange}
        highlightActive={highlightActive}
        onHighlightToggle={handleHighlightToggle}
        searchText={searchText}
        onSearchTextChange={handleSearchTextChange}
        onSearchSubmit={handleSearchSubmit}
        showSearchInput={showSearchInput}
        cullingEnabled={cullingEnabled}
        onCullingToggle={handleCullingToggle}
        cullThreshold={cullThreshold}
        onCullThresholdChange={handleCullThresholdChange}
        dragSmooth={dragSmooth}
        onDragSmoothChange={handleDragSmoothChange}
        zoomSpeed={zoomSpeed}
        onZoomSpeedChange={handleZoomSpeedChange}
      />
      
      <InfoPanel selection={selection} />
      
      <StatsPanel
        stats={stats}
        loadTime={loadTime}
        edgesTime={edgesTime}
        highlightedCount={highlightedCount}
        batchDetails={batchDetails}
        showBatchDetails={showBatchDetails}
        onBatchDetailsToggle={handleBatchDetailsToggle}
      />
      
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

export default App