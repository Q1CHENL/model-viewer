import React from 'react'

interface ViewerStats {
  originalMeshes: number
  batches: number
  uniqueMaterials: number
  unbatchedOriginals: number
}

interface BatchDetail {
  originalCount: number
}

interface StatsPanelProps {
  stats: ViewerStats
  loadTime: string
  edgesTime: string
  highlightedCount: number
  batchDetails: BatchDetail[]
  showBatchDetails: boolean
  onBatchDetailsToggle: () => void
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  loadTime,
  edgesTime,
  highlightedCount,
  batchDetails,
  showBatchDetails,
  onBatchDetailsToggle,
}) => {
  return (
    <div
      id="stats-panel"
      className="absolute z-10 left-4 bottom-4 min-w-[240px] glass-panel p-4 text-white text-sm leading-6"
    >
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Meshes</span>
        <span className="font-semibold text-gray-50 font-mono text-xs" id="stat-meshes">
          {stats.originalMeshes}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Batches</span>
        <button
          className="bg-primary border border-primary/30 text-indigo-200 px-2 py-1 rounded-md text-xs font-semibold transition-all duration-200 hover:bg-primary/30 hover:border-primary/50 hover:text-indigo-100 hover:transform-none hover:shadow-none"
          id="stat-batches-btn"
          onClick={onBatchDetailsToggle}
        >
          {stats.batches}
        </button>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Unbatched</span>
        <span className="font-semibold text-gray-50 font-mono text-xs" id="stat-unbatched">
          {stats.unbatchedOriginals}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Highlighted</span>
        <span className="font-semibold text-gray-50 font-mono text-xs" id="stat-highlighted">
          {highlightedCount}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Materials</span>
        <span className="font-semibold text-gray-50 font-mono text-xs" id="stat-materials">
          {stats.uniqueMaterials}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Loaded in (s)</span>
        <span className="font-semibold text-gray-50 font-mono text-xs" id="stat-loadsec">
          {loadTime}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-1.5 py-0.5">
        <span className="opacity-80 font-medium text-gray-300">Edges added in (s)</span>
        <span className="font-semibold text-gray-50 font-mono text-xs" id="stat-edgessec">
          {edgesTime}
        </span>
      </div>
      
      {showBatchDetails && (
        <div
          id="batch-details"
          className="mt-3 max-h-56 overflow-auto border-t border-white/8 pt-3"
        >
          {batchDetails.map((detail, index) => (
            <div
              key={index}
              className="flex justify-between items-center gap-3 my-1 py-0.5 text-xs"
            >
              <span className="opacity-70 text-gray-400">Batch {index + 1}</span>
              <span className="text-gray-200 font-mono text-xs">
                {detail.originalCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default StatsPanel