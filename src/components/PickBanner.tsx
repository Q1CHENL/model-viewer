import React, { useState, useEffect } from 'react';

const PickBanner: React.FC = () => {
  const [content, setContent] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showBanner = (event: CustomEvent) => {
      setContent(event.detail?.message || '');
      setIsVisible(true);
    };
    
    const hideBanner = () => setIsVisible(false);

    window.addEventListener('viewer:pickBanner' as any, showBanner);
    window.addEventListener('viewer:hidePick' as any, hideBanner);

    return () => {
      window.removeEventListener('viewer:pickBanner' as any, showBanner);
      window.removeEventListener('viewer:hidePick' as any, hideBanner);
    };
  }, []);

  if (!isVisible || !content) return null;

  return (
    <div className="absolute z-20 top-3 left-3 bg-black/85 text-white text-xs px-2 py-1 rounded-md ml-2">
      {content}
    </div>
  );
};

export default PickBanner;