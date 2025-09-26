import React, { useState, useEffect } from 'react';
import { Viewer } from '../viewer/Viewer';

interface InfoPanelProps {
  viewer: Viewer | null;
}

interface SelectionInfo {
  name: string;
  type: string;
  vertices: string;
  triangles: string;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ viewer }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo>({
    name: '-',
    type: '-',
    vertices: '-',
    triangles: '-',
  });

  useEffect(() => {
    if (!viewer) return;

    const handleSelection = (event: CustomEvent) => {
      const { name, type, vertices, triangles, hasSelection } = event.detail;
      
      setSelectionInfo({
        name: name || '-',
        type: type || '-',
        vertices: vertices !== undefined ? String(vertices) : '-',
        triangles: triangles !== undefined ? String(triangles) : '-',
      });
      
      setIsVisible(hasSelection);
    };

    const handleDeselection = () => {
      setIsVisible(false);
      setSelectionInfo({
        name: '-',
        type: '-',
        vertices: '-',
        triangles: '-',
      });
    };

    window.addEventListener('viewer:selection' as any, handleSelection);
    window.addEventListener('viewer:deselection' as any, handleDeselection);

    return () => {
      window.removeEventListener('viewer:selection' as any, handleSelection);
      window.removeEventListener('viewer:deselection' as any, handleDeselection);
    };
  }, [viewer]);

  if (!isVisible) return null;

  return (
    <div className="absolute z-10 top-3 right-3 min-w-[260px] max-w-[400px] bg-black/70 px-3.5 py-3 rounded-md text-white text-sm leading-relaxed">
      <h4 className="m-0 mb-2 font-semibold text-base leading-tight font-system">
        Selection
      </h4>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="opacity-80">Name</span>
        <span className="text-right">{selectionInfo.name}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="opacity-80">Type</span>
        <span className="text-right">{selectionInfo.type}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="opacity-80">Verts</span>
        <span className="text-right">{selectionInfo.vertices}</span>
      </div>
      
      <div className="flex justify-between gap-2 my-0.5">
        <span className="opacity-80">Tris</span>
        <span className="text-right">{selectionInfo.triangles}</span>
      </div>
    </div>
  );
};

export default InfoPanel;