import React, { useState, useRef } from 'react';

const ToolbarButton = ({ icon: Icon, active, onClick, label, description }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTooltip(false);
  };

  return (
    <div className="relative flex items-center justify-center">
      <button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`p-2 rounded-full hover:bg-white/20 transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-white/70'}`}
      >
        <Icon size={16} />
      </button>
      {showTooltip && (
        <div className="absolute bottom-full mb-2 bg-black/90 text-white text-xs p-2 rounded w-48 z-50 pointer-events-none border border-white/10 shadow-lg">
          <div className="font-bold mb-0.5">{label}</div>
          <div className="text-gray-300 leading-tight">{description}</div>
        </div>
      )}
    </div>
  );
};

export default ToolbarButton;
