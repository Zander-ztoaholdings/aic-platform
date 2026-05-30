'use client';

interface ScoreRingProps {
  value: number;
  size?: number;
  thickness?: number;
  showLabel?: boolean;
}

export function ScoreRing({ value, size = 80, thickness = 5, showLabel = true }: ScoreRingProps) {
  const radius = size / 2 - thickness - 1;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (value / 100);

  const color =
    value >= 80 ? '#16a34a' :
    value >= 60 ? '#c9920a' :
    '#dc2626';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={thickness}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold leading-none"
            style={{ fontSize: size * 0.26, color }}
          >
            {value}
          </span>
          <span
            className="font-mono leading-none mt-0.5"
            style={{ fontSize: size * 0.1, color: '#c9920a' }}
          >
            / 100
          </span>
        </div>
      )}
    </div>
  );
}
