import React from 'react'

interface ToolbarProps {
  onFileOpen: () => void
  edgesEnabled: boolean
  onEdgesToggle: () => void
  adaptiveEnabled: boolean
  onAdaptiveToggle: () => void
  batchingEnabled: boolean
  onBatchingToggle: () => void
  maxBatchVertices: number
  onMaxBatchVerticesChange: (value: number) => void
  highlightActive: boolean
  onHighlightToggle: () => void
  searchText: string
  onSearchTextChange: (text: string) => void
  onSearchSubmit: () => void
  showSearchInput: boolean
  cullingEnabled: boolean
  onCullingToggle: () => void
  cullThreshold: number
  onCullThresholdChange: (value: number) => void
  dragSmooth: number
  onDragSmoothChange: (value: number) => void
  zoomSpeed: number
  onZoomSpeedChange: (value: number) => void
}

const Toolbar: React.FC<ToolbarProps> = ({
  onFileOpen,
  edgesEnabled,
  onEdgesToggle,
  adaptiveEnabled,
  onAdaptiveToggle,
  batchingEnabled,
  onBatchingToggle,
  maxBatchVertices,
  onMaxBatchVerticesChange,
  highlightActive,
  onHighlightToggle,
  searchText,
  onSearchTextChange,
  onSearchSubmit,
  showSearchInput,
  cullingEnabled,
  onCullingToggle,
  cullThreshold,
  onCullThresholdChange,
  dragSmooth,
  onDragSmoothChange,
  zoomSpeed,
  onZoomSpeedChange,
}) => {
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit()
    }
  }

  return (
    <div
      id="toolbar"
      className="absolute z-10 top-4 left-4 glass-panel p-3 flex flex-wrap items-center gap-2"
    >
      <button
        className="btn-primary"
        onClick={onFileOpen}
      >
        Open .glb
      </button>

      <button
        className={edgesEnabled ? "btn-primary" : "btn-secondary"}
        onClick={onEdgesToggle}
      >
        Edges: {edgesEnabled ? 'On' : 'Off'}
      </button>

      <button
        className={adaptiveEnabled ? "btn-primary" : "btn-secondary"}
        onClick={onAdaptiveToggle}
      >
        Adaptive Res: {adaptiveEnabled ? 'On' : 'Off'}
      </button>

      <button
        className={batchingEnabled ? "btn-primary" : "btn-secondary"}
        onClick={onBatchingToggle}
      >
        Batching: {batchingEnabled ? 'On' : 'Off'}
      </button>

      <span className="inline-flex items-center gap-2">
        <label className="text-gray-300 text-xs font-medium ml-2">Max. verts</label>
        <input
          className="input-field w-16"
          type="number"
          min="100"
          max="100000"
          value={maxBatchVertices}
          step="100"
          onChange={(e) => onMaxBatchVerticesChange(Number(e.target.value))}
        />
      </span>

      <span className="inline-flex items-center gap-2">
        <button
          className={highlightActive ? "btn-primary" : "btn-secondary"}
          onClick={onHighlightToggle}
        >
          Highlight{highlightActive ? ': On' : ''}
        </button>
        {showSearchInput && (
          <input
            className="input-field w-20"
            type="text"
            placeholder="Search text..."
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
        )}
      </span>

      {/* Clipping controls - keeping old DOM-based approach for now */}
      <span id="clip-config" className="relative inline-block">
        <button id="clip-btn" className="btn-secondary" data-active="false">
          Clip
        </button>
        <div id="clip-menu" className="hidden absolute top-full left-0 glass-panel p-2 min-w-32 shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-20">
          <button id="clip-x" className="w-full text-left my-0.5 px-3 py-2 bg-gray-600/60 rounded-md text-xs hover:bg-primary hover:transform-none">X plane</button>
          <button id="clip-y" className="w-full text-left my-0.5 px-3 py-2 bg-gray-600/60 rounded-md text-xs hover:bg-primary hover:transform-none">Y plane</button>
          <button id="clip-z" className="w-full text-left my-0.5 px-3 py-2 bg-gray-600/60 rounded-md text-xs hover:bg-primary hover:transform-none">Z plane</button>
        </div>
      </span>

      <span className="inline-flex items-center gap-2">
        <button
          className={cullingEnabled ? "btn-primary" : "btn-secondary"}
          onClick={onCullingToggle}
        >
          Cull: {cullingEnabled ? 'On' : 'Off'}
        </button>
        {cullingEnabled && (
          <span className="inline-flex items-center gap-1.5">
            <label className="text-gray-300 text-xs font-medium">Cull(px)</label>
            <input
              className="input-field w-14"
              type="number"
              min="0"
              value={cullThreshold}
              onChange={(e) => onCullThresholdChange(Number(e.target.value))}
            />
          </span>
        )}
      </span>

      <span className="inline-flex items-center gap-1.5">
        <label className="text-gray-300 text-xs font-medium">Drag delay</label>
        <input
          className="input-field w-20"
          type="number"
          min="0"
          step="0.01"
          value={dragSmooth}
          placeholder="Max: 0.5"
          onChange={(e) => onDragSmoothChange(Number(e.target.value))}
        />
      </span>

      <span className="inline-flex items-center gap-1.5">
        <label className="text-gray-300 text-xs font-medium">Zoom step</label>
        <input
          className="input-field w-20"
          type="number"
          min="0.1"
          step="0.1"
          value={zoomSpeed}
          placeholder="×1.0"
          onChange={(e) => onZoomSpeedChange(Number(e.target.value))}
        />
      </span>
    </div>
  )
}

export default Toolbar