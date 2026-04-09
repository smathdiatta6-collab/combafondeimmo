import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ className = "h-12", variant = 'dark' }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <svg
        viewBox="0 0 400 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        {/* Roof - Orange */}
        <path
          d="M20 80L100 20L180 80"
          stroke="#F97316"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M45 80L100 38L155 80"
          stroke="#F97316"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* House Body / C Shape - Blue */}
        <path
          d="M170 110C170 135 145 150 100 150C45 150 30 120 30 95C30 70 55 55 85 55"
          stroke="#1E3A8A"
          strokeWidth="14"
          strokeLinecap="round"
        />
        
        {/* Window - Blue */}
        <rect x="75" y="85" width="18" height="18" fill="#1E3A8A" />
        <rect x="97" y="85" width="18" height="18" fill="#1E3A8A" />
        <rect x="75" y="107" width="18" height="18" fill="#1E3A8A" />
        <rect x="97" y="107" width="18" height="18" fill="#1E3A8A" />

        {/* Text - Blue */}
        <text
          x="190"
          y="115"
          fill="#1E3A8A"
          style={{ font: 'bold 48px sans-serif', letterSpacing: '-1px' }}
        >
          COUMBA FONDE
        </text>
        <text
          x="315"
          y="145"
          fill="#1E3A8A"
          style={{ font: 'bold 24px sans-serif' }}
        >
          IMMO
        </text>
        
        {/* Bottom Line */}
        <path
          d="M100 150H250"
          stroke="#1E3A8A"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default Logo;
