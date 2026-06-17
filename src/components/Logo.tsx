import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ className = "h-12", variant = 'dark' }) => {
  const primaryColor = variant === 'light' ? '#FFFFFF' : '#00215E';
  const accentColor = '#F97316';

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 1000 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto aspect-[4/1]"
      >
        {/* Roof - Orange */}
        <path
          d="M20 100L120 20L220 100"
          stroke={accentColor}
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Chimney */}
        <path
          d="M170 45V65"
          stroke={accentColor}
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* C Shape and Bottom Line - Blue/White depending on variant */}
        <path
          d="M160 85C140 70 100 70 70 85C40 110 40 160 70 185C100 210 160 210 160 185H880"
          stroke={primaryColor}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Window - Blue/White */}
        <rect x="80" y="110" width="22" height="22" fill={primaryColor} />
        <rect x="108" y="110" width="22" height="22" fill={primaryColor} />
        <rect x="80" y="138" width="22" height="22" fill={primaryColor} />
        <rect x="108" y="138" width="22" height="22" fill={primaryColor} />

        {/* Text - COUMBA FONDE */}
        <text
          x="150"
          y="165"
          fill={primaryColor}
          style={{ 
            font: '900 82px "Arial Narrow", sans-serif', 
            textTransform: 'uppercase',
            letterSpacing: '-2px'
          }}
        >
          COUMBA FONDE
        </text>
        
        {/* Text - IMMO */}
        <text
          x="755"
          y="235"
          fill={primaryColor}
          style={{ 
            font: '900 36px "Arial Narrow", sans-serif',
            textTransform: 'uppercase'
          }}
        >
          IMMO
        </text>
      </svg>
    </div>
  );
};

export default Logo;
