import React, { useState, useRef, useEffect } from 'react';
import { Viewer } from '../viewer/Viewer';

interface ToolbarProps {
  viewer: Viewer | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ viewer }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for toggles
  const [edgesEnabled, setEdgesEnabled] = useState(false);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(false);
  const [batchingEnabled, setBatchingEnabled] = useState(true);
  const [highlightSearchActive, setHighlightSearchActive] = useState(false);
  const [clipActive, setClipActive] = useState(false);
  const [cullEnabled, setCullEnabled] = useState(false);
  
  // State for inputs
  const [searchText, setSearchText] = useState('00');
  const [cullThreshold, setCullThreshold] = useState(50);
  const [dragSmooth, setDragSmooth] = useState(0.05);
  const [zoomSpeed, setZoomSpeed] = useState(0.5);
  
  // State for UI visibility
  const [showClipMenu, setShowClipMenu] = useState(false);
  const [showCullInput, setShowCullInput] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

  useEffect(() => {
    if (!viewer) return;
    
    // Initialize viewer states
    viewer.setBatchingEnabled(batchingEnabled);
    viewer.setCullingEnabled(cullEnabled);
    viewer.setAdaptiveEnabled(adaptiveEnabled);
    viewer.setCullingThreshold(cullThreshold);
    viewer.setDraggingSmoothTime(dragSmooth);
    viewer.setZoomSpeed(zoomSpeed);
  }, [viewer]);

  const handleFileOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !viewer) return;

    // Ensure edges are OFF for new model load
    viewer.setEdgesEnabled(false);
    setEdgesEnabled(false);
    
    
    const t0 = performance.now();
    await viewer.loadGLBFromFile(file);
    const t1 = performance.now();
    const sec = Math.round((t1 - t0) / 10) / 100;
    
    // Dispatch load time event
    window.dispatchEvent(new CustomEvent('viewer:modelLoaded', { 
      detail: { loadTime: sec } 
    }));
    event.target.value = '';
  };

  const handleEdgesToggle = () => {
    if (!viewer) return;
    const next = !edgesEnabled;
    setEdgesEnabled(next);
    
    if (next) {
      if (!viewer.hasBuiltEdges()) {
        window.dispatchEvent(new CustomEvent('viewer:edgesBuilding'));
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          viewer.setEdgesEnabled(true);
        });
      });
    } else {
      viewer.setEdgesEnabled(false);
    }
  };

  const handleAdaptiveToggle = () => {
    if (!viewer) return;
    const next = !adaptiveEnabled;
    setAdaptiveEnabled(next);
    viewer.setAdaptiveEnabled(next);
  };

  const handleBatchingToggle = () => {
    if (!viewer) return;
    const next = !batchingEnabled;
    setBatchingEnabled(next);
    viewer.setBatchingEnabled(next);
  };

  const handleHighlightToggle = () => {
    if (!viewer) return;
    const next = !highlightSearchActive;
    setHighlightSearchActive(next);
    setShowSearchInput(next);
    
    if (next && searchText.trim()) {
      viewer.getHighlightController().highlightTextMeshes(true, searchText);
    } else {
      viewer.getHighlightController().highlightTextMeshes(false, '');
    }
  };

  const handleSearchTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setSearchText(text);
    
    if (!viewer) return;
    
    if (highlightSearchActive && text.trim()) {
      viewer.getHighlightController().highlightTextMeshes(true, text);
    } else {
      viewer.getHighlightController().highlightTextMeshes(false, '');
    }
  };

  const handleClipToggle = () => {
    if (!viewer) return;
    
    if (clipActive) {
      viewer.deleteAllClipPlanes();
      setClipActive(false);
      setShowClipMenu(false);
    } else {
      setShowClipMenu(true);
    }
  };

  const handleClipAxis = (axis: 'x' | 'y' | 'z') => {
    if (!viewer) return;
    viewer.createClipPlaneAxis(axis);
    setClipActive(true);
    setShowClipMenu(false);
  };

  const handleCullToggle = () => {
    if (!viewer) return;
    const next = !cullEnabled;
    setCullEnabled(next);
    setShowCullInput(next);
    viewer.setCullingEnabled(next);
  };

  const handleCullThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setCullThreshold(value);
      viewer?.setCullingThreshold(value);
    }
  };

  const handleDragSmoothChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
      setDragSmooth(value);
      viewer?.setDraggingSmoothTime(value);
    }
  };

  const handleZoomSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
      setZoomSpeed(value);
      viewer?.setZoomSpeed(value);
    }
  };

  return (
    <div className="absolute z-10 top-3 left-3 bg-black/70 p-2 px-2.5 rounded-md">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* File Open */}
        <button
          onClick={handleFileOpen}
          className="text-white bg-purple-600 hover:bg-purple-700 border-0 px-3 py-2 rounded-md cursor-pointer"
        >
          Open .glb
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Edges Toggle */}
        <button
          onClick={handleEdgesToggle}
          className={`text-white border-0 px-3 py-2 rounded-md cursor-pointer ${
            edgesEnabled ? 'bg-purple-600' : 'bg-gray-600 text-gray-300'
          }`}
        >
          Edges: {edgesEnabled ? 'On' : 'Off'}
        </button>

        {/* Adaptive Resolution Toggle */}
        <button
          onClick={handleAdaptiveToggle}
          className={`text-white border-0 px-3 py-2 rounded-md cursor-pointer ${
            adaptiveEnabled ? 'bg-purple-600' : 'bg-gray-600 text-gray-300'
          }`}
        >
          Adaptive Res: {adaptiveEnabled ? 'On' : 'Off'}
        </button>

        {/* Batching Toggle */}
        <button
          onClick={handleBatchingToggle}
          className={`text-white border-0 px-3 py-2 rounded-md cursor-pointer ${
            batchingEnabled ? 'bg-purple-600' : 'bg-gray-600 text-gray-300'
          }`}
        >
          Batching: {batchingEnabled ? 'On' : 'Off'}
        </button>

        {/* Highlight Search */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleHighlightToggle}
            className={`text-white border-0 px-3 py-2 rounded-md cursor-pointer ${
              highlightSearchActive ? 'bg-purple-600' : 'bg-gray-600 text-gray-300'
            }`}
          >
            Highlight names
          </button>
          {showSearchInput && (
            <input
              type="text"
              placeholder="Search text..."
              value={searchText}
              onChange={handleSearchTextChange}
              className="w-20 px-1.5 py-1 border border-gray-600 rounded bg-gray-800/90 text-white text-xs placeholder-gray-400"
            />
          )}
        </div>

        {/* Clipping */}
        <div className="relative">
          <button
            onClick={handleClipToggle}
            onMouseEnter={() => clipActive && setShowClipMenu(true)}
            onMouseLeave={() => setShowClipMenu(false)}
            className={`text-white border-0 px-3 py-2 rounded-md cursor-pointer ${
              clipActive ? 'bg-purple-600' : 'bg-gray-600 text-gray-300'
            }`}
          >
            Clip
          </button>
          {showClipMenu && (
            <div
              className="absolute top-full left-0 bg-black/95 rounded-md p-1.5 min-w-[120px]"
              onMouseEnter={() => setShowClipMenu(true)}
              onMouseLeave={() => setShowClipMenu(false)}
            >
              <button
                onClick={() => handleClipAxis('x')}
                className="w-full text-left text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-md my-0.5"
              >
                X plane
              </button>
              <button
                onClick={() => handleClipAxis('y')}
                className="w-full text-left text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-md my-0.5"
              >
                Y plane
              </button>
              <button
                onClick={() => handleClipAxis('z')}
                className="w-full text-left text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-md my-0.5"
              >
                Z plane
              </button>
            </div>
          )}
        </div>

        {/* Culling */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCullToggle}
            className={`text-white border-0 px-3 py-2 rounded-md cursor-pointer ${
              cullEnabled ? 'bg-purple-600' : 'bg-gray-600 text-gray-300'
            }`}
          >
            Cull: {cullEnabled ? 'On' : 'Off'}
          </button>
          {showCullInput && (
            <div className="flex items-center gap-1">
              <label htmlFor="cull-threshold" className="text-white text-xs ml-1.5">
                Cull(px)
              </label>
              <input
                id="cull-threshold"
                type="number"
                min="0"
                value={cullThreshold}
                onChange={handleCullThresholdChange}
                className="w-12 px-1 py-0.5 text-xs bg-gray-800 text-white border border-gray-600 rounded"
              />
            </div>
          )}
        </div>

        {/* Drag Delay */}
        <div className="flex items-center gap-1">
          <label htmlFor="drag-smooth" className="text-white text-xs">
            Drag delay
          </label>
          <input
            id="drag-smooth"
            type="number"
            min="0"
            step="0.01"
            value={dragSmooth}
            onChange={handleDragSmoothChange}
            placeholder="Max: 0.5"
            className="w-18 px-1 py-0.5 text-xs bg-gray-800 text-white border border-gray-600 rounded"
          />
        </div>

        {/* Zoom Speed */}
        <div className="flex items-center gap-1">
          <label htmlFor="zoom-speed" className="text-white text-xs">
            Zoom step
          </label>
          <input
            id="zoom-speed"
            type="number"
            min="0.1"
            step="0.1"
            value={zoomSpeed}
            onChange={handleZoomSpeedChange}
            placeholder="×1.0"
            className="w-18 px-1 py-0.5 text-xs bg-gray-800 text-white border border-gray-600 rounded"
          />
        </div>
      </div>
    </div>
  );
};

export default Toolbar;