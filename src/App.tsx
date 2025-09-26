import React, { useEffect, useRef } from 'react';
import { Viewer } from './viewer/Viewer';
import Toolbar from './components/Toolbar';
import StatsPanel from './components/StatsPanel';
import InfoPanel from './components/InfoPanel';
import EdgesBanner from './components/EdgesBanner';
import PickBanner from './components/PickBanner';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  
  useEffect(() => {
    if (containerRef.current && !viewerRef.current) {
      viewerRef.current = new Viewer(containerRef.current);
    }
    
    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="h-full relative">
      <EdgesBanner />
      <PickBanner />
      <Toolbar viewer={viewerRef.current} />
      <InfoPanel viewer={viewerRef.current} />
      <StatsPanel viewer={viewerRef.current} />
      <div 
        ref={containerRef} 
        className="h-full w-full"
      />
    </div>
  );
};

export default App;