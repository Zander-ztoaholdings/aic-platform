"use client";

import React from "react";

interface AICLogoProps {
  variant?: "full" | "icon";
  scheme?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AICLogo({
  variant = "full",
  scheme = "dark",
  size = "md",
  className = "",
}: AICLogoProps) {
  const sizes = {
    sm: variant === "full" ? { w: 120, h: 34 } : { w: 40, h: 40 },
    md: variant === "full" ? { w: 158, h: 45 } : { w: 56, h: 56 },
    lg: variant === "full" ? { w: 220, h: 62 } : { w: 80, h: 80 },
    xl: variant === "full" ? { w: 320, h: 90 } : { w: 120, h: 120 },
  };

  const { w, h } = sizes[size];
  const gold = "#c9920a";
  const navy = "#0a1628";
  const primaryColor = scheme === "dark" ? "var(--aic-paper)" : navy;

  return (
    <div className={`inline-flex items-center ${className}`}>
      <svg
        viewBox={variant === "full" ? "0 0 280 80" : "0 0 80 80"}
        width={w}
        height={h}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={variant === "full" ? "translate(0, 10)" : "translate(5, 10)"}>
          <path
            d="M35 5L12 14V30C12 42 20 52 35 60C50 52 58 42 58 30V14L35 5Z"
            fill={primaryColor}
            fillOpacity="0.1"
          />
          <path
            d="M35 10L17 17V30C17 40 24 48 35 55C46 48 53 40 53 30V17L35 10Z"
            fill={primaryColor}
            fillOpacity="0.05"
          />
          <circle cx="35" cy="24" r="5" fill={gold} />
          <path
            d="M35 30C30 30 26 33 26 37V45C26 46 27 47 28 47H42C43 47 44 46 44 45V37C44 33 40 30 35 30Z"
            fill={gold}
          />
          <circle cx="25" cy="35" r="1.5" fill={gold} opacity="0.4" />
          <circle cx="45" cy="35" r="1.5" fill={gold} opacity="0.4" />
        </g>

        {variant === "full" && (
          <g transform="translate(75, 0)">
            <text
              x="0"
              y="42"
              fill={primaryColor}
              fontSize="36"
              fontWeight="700"
              style={{ fontFamily: "var(--font-serif), serif" }}
              letterSpacing="-0.5"
            >
              AIC
            </text>
            <text
              x="0"
              y="58"
              fill={primaryColor}
              fillOpacity="0.6"
              fontSize="9"
              fontWeight="500"
              style={{ fontFamily: "var(--font-mono), monospace" }}
              letterSpacing="2"
            >
              AI INTEGRITY CERTIFICATION
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
