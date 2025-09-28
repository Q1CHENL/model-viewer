import React from 'react'

interface SelectionInfo {
  name: string
  type: string
  verts: string
  tris: string
}

interface InfoPanelProps {
  selection: SelectionInfo
}

const InfoPanel: React.FC<InfoPanelProps> = ({ selection }) => {
  return (
    <div
      id="info-panel"
      className="absolute z-10 top-4 right-4 min-w-[280px] max-w-[420px] glass-panel p-4 text-white text-sm leading-6 hidden"
    >
      <h4 className="mb-3 font-semibold text-base leading-tight text-gray-50 tracking-tight">
        Selection
      </h4>
      
      <div className="flex justify-between items-center gap-3 my-2 py-1">
        <span className="opacity-80 font-medium text-gray-300">Name</span>
        <span className="text-right font-semibold text-gray-50 font-mono text-xs" id="sel-name">
          {selection.name}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-2 py-1">
        <span className="opacity-80 font-medium text-gray-300">Type</span>
        <span className="text-right font-semibold text-gray-50 font-mono text-xs" id="sel-type">
          {selection.type}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-2 py-1">
        <span className="opacity-80 font-medium text-gray-300">Verts</span>
        <span className="text-right font-semibold text-gray-50 font-mono text-xs" id="sel-verts">
          {selection.verts}
        </span>
      </div>
      
      <div className="flex justify-between items-center gap-3 my-2 py-1">
        <span className="opacity-80 font-medium text-gray-300">Tris</span>
        <span className="text-right font-semibold text-gray-50 font-mono text-xs" id="sel-tris">
          {selection.tris}
        </span>
      </div>
    </div>
  )
}

export default InfoPanel