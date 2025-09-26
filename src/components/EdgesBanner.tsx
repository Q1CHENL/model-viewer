import React, { useState, useEffect } from 'react';

const EdgesBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showBanner = () => setIsVisible(true);
    const hideBanner = () => setIsVisible(false);

    window.addEventListener('viewer:edgesBuilding', showBanner);
    window.addEventListener('viewer:edgesBuilt', hideBanner);

    return () => {
      window.removeEventListener('viewer:edgesBuilding', showBanner);
      window.removeEventListener('viewer:edgesBuilt', hideBanner);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="absolute z-20 top-3 left-1/2 transform -translate-x-1/2 bg-black/85 text-white text-sm px-2.5 py-1.5 rounded-md">
      Adding edges…
    </div>
  );
};

export default EdgesBanner;