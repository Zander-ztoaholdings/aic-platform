'use client';

import { motion } from 'framer-motion';

interface AlphaSealProps {
    tier?: 1 | 2 | 3;
    variant?: 'minimal' | 'detailed' | 'shield';
    className?: string;
}

export const AlphaSeal = ({ tier = 1, variant = 'detailed', className = "" }: AlphaSealProps) => {
    const colors = {
        1: '#C41E3A', // Tier 1 Red
        2: '#FF8C42', // Tier 2 Orange
        3: '#2C5F2D', // Tier 3 Green
    };

    const color = colors[tier as keyof typeof colors];

    if (variant === 'shield') {
        return (
            <motion.div 
                whileHover={{ scale: 1.05 }}
                className={`relative w-32 h-40 ${className}`}
            >
                <svg viewBox="0 0 100 125" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 5L10 25V55C10 75 50 95 50 95C50 95 90 75 90 55V25L50 5Z" fill="#121212" stroke={color} strokeWidth="2"/>
                    <text x="50" y="45" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="monospace">AIC</text>
                    <text x="50" y="55" textAnchor="middle" fill={color} fontSize="6" fontWeight="bold" fontFamily="monospace">ALPHA</text>
                    <text x="50" y="65" textAnchor="middle" fill="white" fontSize="5" fontFamily="serif">TIER 0{tier}</text>
                </svg>
            </motion.div>
        );
    }

    return (
        <motion.div 
            whileHover={{ rotate: 5, scale: 1.05 }}
            className={`relative w-32 h-32 ${className}`}
        >
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="48" stroke="#D4AF37" strokeWidth="0.5" strokeDasharray="2 2"/>
                <circle cx="50" cy="50" r="44" stroke="#121212" strokeWidth="4"/>
                
                {/* Tier Indicator */}
                <circle cx="50" cy="50" r="44" stroke={color} strokeWidth="4" strokeDasharray="70 300" transform="rotate(-90 50 50)"/>

                {/* Text Path */}
                <path id="curve" d="M 20, 50 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0" fill="transparent" />
                <text fontSize="6" fontWeight="bold" fontFamily="monospace" fill="#D4AF37" letterSpacing="1">
                    <textPath href="#curve" startOffset="0"> • AI INTEGRITY • ALPHA CERTIFIED • </textPath>
                </text>

                {/* Center Content */}
                <text x="50" y="48" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="serif">AIC.</text>
                <text x="50" y="58" textAnchor="middle" fill={color} fontSize="5" fontWeight="bold" fontFamily="monospace" tracking-widest>TIER 0{tier}</text>
                <text x="50" y="65" textAnchor="middle" fill="gray" fontSize="3" fontFamily="monospace">EST. 2026</text>
            </svg>
        </motion.div>
    );
};
