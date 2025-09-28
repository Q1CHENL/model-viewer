import React from 'react'

interface EdgesBannerProps {
  show: boolean
}

const EdgesBanner: React.FC<EdgesBannerProps> = ({ show }) => {
  if (!show) return null

  return (
    <div
      id="edges-banner"
      className="absolute z-20 top-4 left-1/2 transform -translate-x-1/2 bg-primary backdrop-blur-[16px] text-white font-medium text-sm px-4 py-2.5 rounded-xl border border-white/10 shadow-[0_8px_25px_rgba(16,185,129,0.3),0_3px_10px_rgba(0,0,0,0.2)] animate-[slideDown_0.3s_ease]"
    >
      Adding edges…
    </div>
  )
}

export default EdgesBanner