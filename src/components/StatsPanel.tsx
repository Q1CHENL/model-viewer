import React, { useState, useEffect } from 'react';
import { Viewer, type BatchInfoItem } from '../viewer/Viewer';

interface StatsPanelProps {
  viewer: Viewer | null;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ viewer }) => {
  const [stats, setStats] = useState({
    originalMeshes: 0,
    batches: 0,
    uniqueMaterials: 0,
    unbatchedOriginals: 0,
    highlighted: 0,
    loadTime: 'N/A',
    edgesTime: 'N/A',
  });
  
  const [batchDetailsOpen, setBatchDetailsOpen] = useState(false);
  const [batchDetails, setBatchDetails] = useState<BatchInfoItem[]>([]);

  const updateStats = () => {
    if (!viewer) return;
    
    const viewerStats = viewer.getStats();
    const highlighted = viewer.getHighlightedCount();
    
    setStats(prev => ({
      ...prev,
      originalMeshes: viewerStats.originalMeshes,
      batches: viewerStats.batches,
      uniqueMaterials: viewerStats.uniqueMaterials,
      unbatchedOriginals: viewerStats.unbatchedOriginals,
      highlighted,
    }));
    
    if (batchDetailsOpen) {
      setBatchDetails(viewer.getBatchDetails());
    }
  };

  const toggleBatchDetails = () => {
    const newOpen = !batchDetailsOpen;
    setBatchDetailsOpen(newOpen);
    
    if (newOpen && viewer) {
      setBatchDetails(viewer.getBatchDetails());
    }
  };

  useEffect(() => {
    updateStats();
    
    const handleModelLoaded = (event: CustomEvent) => {
      setStats(prev => ({
        ...prev,
        loadTime: event.detail.loadTime.toFixed(2),
        edgesTime: 'N/A',
      }));
      updateStats();
    };
    
    const handleEdgesBuilt = (event: CustomEvent) => {
      const ms = event.detail?.ms;
      if (typeof ms === 'number') {
        setStats(prev => ({
          ...prev,
          edgesTime: (ms / 1000).toFixed(2),
        }));
      }
    };
    
    const handleHighlightChanged = () => {
      updateStats();
    };

    window.addEventListener('viewer:modelLoaded' as any, handleModelLoaded);
    window.addEventListener('viewer:edgesBuilt' as any, handleEdgesBuilt);
    window.addEventListener('viewer:highlightChanged', handleHighlightChanged);

    return () => {
      window.removeEventListener('viewer:modelLoaded' as any, handleModelLoaded);
      window.removeEventListener('viewer:edgesBuilt' as any, handleEdgesBuilt);
      window.removeEventListener('viewer:highlightChanged', handleHighlightChanged);
    };
  }, [viewer, batchDetailsOpen]);

  return (
    <div className="absolute z-10 left-3 bottom-3 min-w-[210px] bg-black/70 px-3 py-2.5 rounded-md text-white text-sm leading-relaxed">
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Meshes</span>
        <span className="val">{stats.originalMeshes}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Batches</span>
        <button
          onClick={toggleBatchDetails}
          className="val text-white bg-transparent border-0 cursor-pointer text-right"
        >
          {stats.batches}
        </button>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Unbatched</span>
        <span className="val">{stats.unbatchedOriginals}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Highlighted</span>
        <span className="val">{stats.highlighted}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Materials</span>
        <span className="val">{stats.uniqueMaterials}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Loaded in (s)</span>
        <span className="val">{stats.loadTime}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="key">Edges added in (s)</span>
        <span className="val">{stats.edgesTime}</span>
      </div>
      
      {batchDetailsOpen && (
        <div className="mt-1.5 max-h-48 overflow-auto">
          {batchDetails.map((detail, index) => (
            <div key={index} className="flex justify-between gap-2 my-0.5 text-xs">
              <span className="key">Batch {index + 1}</span>
              <span className="val">{detail.originalCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatsPanel;