"use client";

interface HodlLogoProps {
  size?: number;
  className?: string;
}

/**
 * SVG diamond logo for HODL Exchange.
 * Replaces the low-resolution hodl-logo.png with a crisp vector version.
 */
export function HodlLogo({ size = 120, className = "" }: HodlLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HODL Exchange"
    >
      {/* Outer diamond */}
      <path
        d="M60 4L112 60L60 116L8 60L60 4Z"
        stroke="url(#diamondGradient)"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Inner diamond */}
      <path
        d="M60 20L96 60L60 100L24 60L60 20Z"
        fill="url(#innerGradient)"
        opacity="0.15"
      />
      {/* Inner diamond stroke */}
      <path
        d="M60 20L96 60L60 100L24 60L60 20Z"
        stroke="url(#diamondGradient)"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Center cross lines */}
      <line x1="60" y1="32" x2="60" y2="88" stroke="url(#diamondGradient)" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="60" x2="88" y2="60" stroke="url(#diamondGradient)" strokeWidth="1" opacity="0.5" />
      {/* H letter */}
      <text
        x="60"
        y="67"
        textAnchor="middle"
        fill="url(#textGradient)"
        fontSize="28"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="1"
      >
        H
      </text>
      <defs>
        <linearGradient id="diamondGradient" x1="60" y1="4" x2="60" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="innerGradient" x1="60" y1="20" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="textGradient" x1="60" y1="45" x2="60" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#BFDBFE" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
    </svg>
  );
}
