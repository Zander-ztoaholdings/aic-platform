'use client';

/**
 * AICCharacter — The AIC brand signature figure.
 *
 * A Pixar-inspired human silhouette rendered as expressive black-and-white
 * SVG line art. Different poses represent AIC's core promise: a human
 * observer, always in the loop.
 *
 * Animation philosophy:
 *  - Spring physics (high stiffness, natural damping) for organic feel
 *  - Squash & stretch on key transitions — the Pixar secret
 *  - Follow-through: secondary elements (hair, arm) trail behind primary motion
 *  - Asymmetric idle cycle so the figure never feels robotic
 */

import { motion, useAnimationControls, Variants, TargetAndTransition } from 'framer-motion';
import { useEffect, useState } from 'react';

type Pose = 'idle' | 'thinking' | 'reviewing' | 'approving';
type Scheme = 'light' | 'dark';

interface AICCharacterProps {
  pose?: Pose;
  scheme?: Scheme;
  size?: number;
  className?: string;
  animate?: boolean;
}

// ─── Spring config presets ───────────────────────────────────────────────────
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 280, damping: 18 };
const SPRING_SOFT   = { type: 'spring' as const, stiffness: 120, damping: 14 };
const SPRING_HEAVY  = { type: 'spring' as const, stiffness: 80,  damping: 20 };

// ─── Pose variants — per body-part transforms ────────────────────────────────
const poseVariants: Record<Pose, {
  head:   Record<string, unknown>;
  torso:  Record<string, unknown>;
  armL:   Record<string, unknown>;
  armR:   Record<string, unknown>;
  hairA:  Record<string, unknown>;
  hairB:  Record<string, unknown>;
}> = {
  idle: {
    head:  { rotate: 0,   y: 0,    scaleY: 1    },
    torso: { rotate: 0,   scaleY: 1              },
    armL:  { rotate: 0,   y: 0                   },
    armR:  { rotate: 0,   y: 0                   },
    hairA: { rotate: 0,   x: 0                   },
    hairB: { rotate: 0,   x: 0                   },
  },
  thinking: {
    head:  { rotate: -8,  y: -4,   scaleY: 0.97 },
    torso: { rotate: -3,  scaleY: 1              },
    armL:  { rotate: -35, y: -12                 },
    armR:  { rotate: 20,  y: 0                   },
    hairA: { rotate: -5,  x: -2                  },
    hairB: { rotate: -3,  x: -1                  },
  },
  reviewing: {
    head:  { rotate: 5,   y: 6,    scaleY: 1.02 },
    torso: { rotate: 2,   scaleY: 0.98           },
    armL:  { rotate: 15,  y: 8                   },
    armR:  { rotate: -25, y: 6                   },
    hairA: { rotate: 3,   x: 2                   },
    hairB: { rotate: 2,   x: 1                   },
  },
  approving: {
    head:  { rotate: -3,  y: -8,   scaleY: 1.04 },
    torso: { rotate: 0,   scaleY: 1.02           },
    armL:  { rotate: -60, y: -20                 },
    armR:  { rotate: -15, y: -10                 },
    hairA: { rotate: -8,  x: -3                  },
    hairB: { rotate: -5,  x: -2                  },
  },
};

// ─── Idle breathing cycle ────────────────────────────────────────────────────
const breatheVariants: Variants = {
  inhale: {
    scaleY: 1.018,
    y: -1.5,
    transition: { duration: 2.4, ease: 'easeInOut' },
  },
  exhale: {
    scaleY: 1,
    y: 0,
    transition: { duration: 2.6, ease: 'easeInOut' },
  },
};

const headSway: Variants = {
  left:  { rotate: -2.5, transition: { duration: 3.2, ease: 'easeInOut' } },
  right: { rotate:  2.5, transition: { duration: 3.2, ease: 'easeInOut' } },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function AICCharacter({
  pose = 'idle',
  scheme = 'dark',
  size = 280,
  className = '',
  animate: shouldAnimate = true,
}: AICCharacterProps) {
  const stroke = scheme === 'dark' ? '#F9F8F4' : '#0A1728';
  const copperStroke = '#c87941';

  const torsoControls = useAnimationControls();
  const headControls  = useAnimationControls();
  const armLControls  = useAnimationControls();
  const armRControls  = useAnimationControls();
  const hairAControls = useAnimationControls();
  const hairBControls = useAnimationControls();

  const [breathePhase, setBreathePhase] = useState<'inhale' | 'exhale'>('exhale');
  const [swayPhase, setSwayPhase] = useState<'left' | 'right'>('left');

  // Animate to pose on prop change
  useEffect(() => {
    if (!shouldAnimate) return;
    const p = poseVariants[pose];
    torsoControls.start({ ...p.torso, transition: SPRING_SOFT });
    headControls.start({ ...p.head,  transition: SPRING_SNAPPY });
    armLControls.start({ ...p.armL,  transition: SPRING_HEAVY });
    armRControls.start({ ...p.armR,  transition: SPRING_HEAVY });
    hairAControls.start({ ...p.hairA, transition: SPRING_SOFT });
    hairBControls.start({ ...p.hairB, transition: SPRING_SOFT });
  }, [pose, shouldAnimate, torsoControls, headControls, armLControls, armRControls, hairAControls, hairBControls]);

  // Idle breathing cycle
  useEffect(() => {
    if (!shouldAnimate) return;
    const id = setInterval(() => {
      setBreathePhase(p => p === 'exhale' ? 'inhale' : 'exhale');
    }, 2600);
    return () => clearInterval(id);
  }, [shouldAnimate]);

  // Head gentle sway (offset from breathe so they don't peak together)
  useEffect(() => {
    if (!shouldAnimate) return;
    const id = setInterval(() => {
      setSwayPhase(p => p === 'left' ? 'right' : 'left');
    }, 3200);
    return () => clearInterval(id);
  }, [shouldAnimate]);

  const sw = (base: number) => (base / 200) * 2.2; // strokeWidth relative to viewBox

  return (
    <svg
      viewBox="0 0 200 420"
      width={size}
      height={size * (420 / 200)}
      fill="none"
      aria-label="AIC — Human in the Loop"
      className={className}
      style={{ overflow: 'visible' }}
    >
      {/* ── Legs (static base) ─────────────────────────────────── */}
      <g>
        {/* Left leg */}
        <motion.path
          d="M 88 246 C 85 280 80 310 78 340"
          stroke={stroke}
          strokeWidth={sw(2.2)}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8, ease: 'easeOut' }}
        />
        {/* Right leg */}
        <motion.path
          d="M 112 246 C 115 280 120 310 122 340"
          stroke={stroke}
          strokeWidth={sw(2.2)}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
        />
        {/* Left foot */}
        <motion.path
          d="M 78 340 C 74 348 66 350 62 348"
          stroke={stroke}
          strokeWidth={sw(2)}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5, ease: 'easeOut' }}
        />
        {/* Right foot */}
        <motion.path
          d="M 122 340 C 126 348 134 350 138 348"
          stroke={stroke}
          strokeWidth={sw(2)}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5, ease: 'easeOut' }}
        />
      </g>

      {/* ── Torso group (breathes) ──────────────────────────────── */}
      <motion.g
        animate={(shouldAnimate ? breatheVariants[breathePhase] : {}) as TargetAndTransition}
        style={{ originX: '100px', originY: '200px' }}
      >
        <motion.g animate={torsoControls} style={{ originX: '100px', originY: '160px' }}>
          {/* Spine curve */}
          <motion.path
            d="M 100 140 C 98 170 100 200 101 240"
            stroke={stroke}
            strokeWidth={sw(1.6)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.9, ease: 'easeOut' }}
          />
          {/* Left torso line */}
          <motion.path
            d="M 85 130 C 82 165 82 205 88 246"
            stroke={stroke}
            strokeWidth={sw(2)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.9, ease: 'easeOut' }}
          />
          {/* Right torso line */}
          <motion.path
            d="M 115 130 C 118 165 118 205 112 246"
            stroke={stroke}
            strokeWidth={sw(2)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.9, ease: 'easeOut' }}
          />
          {/* Hip band */}
          <motion.path
            d="M 88 246 C 94 250 106 250 112 246"
            stroke={stroke}
            strokeWidth={sw(1.8)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.4, ease: 'easeOut' }}
          />

          {/* ── Left arm ─────────────────────────────────────────── */}
          <motion.g animate={armLControls} style={{ originX: '82px', originY: '132px' }}>
            {/* Shoulder to elbow */}
            <motion.path
              d="M 82 132 C 65 150 52 168 48 190"
              stroke={stroke}
              strokeWidth={sw(2)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
            />
            {/* Elbow to wrist */}
            <motion.path
              d="M 48 190 C 44 205 42 220 44 232"
              stroke={stroke}
              strokeWidth={sw(1.8)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
            />
            {/* Hand — expressive open fingers */}
            <motion.path
              d="M 44 232 C 40 240 36 245 34 242"
              stroke={stroke}
              strokeWidth={sw(1.6)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.4, ease: 'easeOut' }}
            />
            <motion.path
              d="M 44 232 C 42 242 40 248 38 246"
              stroke={copperStroke}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ delay: 0.7, duration: 0.4, ease: 'easeOut' }}
            />
            <motion.path
              d="M 44 232 C 46 242 46 248 44 246"
              stroke={stroke}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.72, duration: 0.4, ease: 'easeOut' }}
            />
          </motion.g>

          {/* ── Right arm ────────────────────────────────────────── */}
          <motion.g animate={armRControls} style={{ originX: '118px', originY: '132px' }}>
            {/* Shoulder to elbow */}
            <motion.path
              d="M 118 132 C 135 150 148 168 152 190"
              stroke={stroke}
              strokeWidth={sw(2)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.8, ease: 'easeOut' }}
            />
            {/* Elbow to wrist */}
            <motion.path
              d="M 152 190 C 156 205 158 220 156 232"
              stroke={stroke}
              strokeWidth={sw(1.8)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.62, duration: 0.6, ease: 'easeOut' }}
            />
            {/* Hand */}
            <motion.path
              d="M 156 232 C 160 240 164 245 166 242"
              stroke={stroke}
              strokeWidth={sw(1.6)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.68, duration: 0.4, ease: 'easeOut' }}
            />
            <motion.path
              d="M 156 232 C 158 242 160 248 162 246"
              stroke={copperStroke}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ delay: 0.72, duration: 0.4, ease: 'easeOut' }}
            />
            <motion.path
              d="M 156 232 C 154 242 154 248 156 246"
              stroke={stroke}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.74, duration: 0.4, ease: 'easeOut' }}
            />
          </motion.g>

          {/* Shoulder line — the "wingspan" */}
          <motion.path
            d="M 62 126 C 75 128 100 130 138 126"
            stroke={stroke}
            strokeWidth={sw(1.8)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.5, ease: 'easeOut' }}
          />
        </motion.g>
      </motion.g>

      {/* ── Head group (sways gently) ───────────────────────────── */}
      <motion.g
        animate={(shouldAnimate ? headSway[swayPhase] : {}) as TargetAndTransition}
        style={{ originX: '100px', originY: '110px' }}
      >
        <motion.g animate={headControls} style={{ originX: '100px', originY: '82px' }}>

          {/* Neck */}
          <motion.path
            d="M 92 106 C 91 115 90 122 88 130"
            stroke={stroke}
            strokeWidth={sw(1.8)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
          />
          <motion.path
            d="M 108 106 C 109 115 110 122 112 130"
            stroke={stroke}
            strokeWidth={sw(1.8)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.4, ease: 'easeOut' }}
          />

          {/* Head outline — slightly asymmetric for personality */}
          <motion.ellipse
            cx="100"
            cy="68"
            rx="30"
            ry="34"
            stroke={stroke}
            strokeWidth={sw(2.4)}
            initial={{ pathLength: 0, opacity: 0, scale: 0.8 }}
            animate={{ pathLength: 1, opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, duration: 0.7, ease: 'easeOut' }}
            style={{ originX: '100px', originY: '68px' }}
          />

          {/* ── Hair — the artistic Pixar touch ─────────────────── */}

          {/* Main hair flow — left side */}
          <motion.g animate={hairAControls} style={{ originX: '80px', originY: '40px' }}>
            <motion.path
              d="M 74 55 C 68 38 70 24 80 18 C 86 14 94 13 100 14"
              stroke={stroke}
              strokeWidth={sw(2)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.7, ease: 'easeOut' }}
            />
            {/* flowing strand */}
            <motion.path
              d="M 72 62 C 58 48 56 30 65 18 C 70 12 78 8 85 9"
              stroke={stroke}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ delay: 0.1, duration: 0.8, ease: 'easeOut' }}
            />
            {/* fine strand */}
            <motion.path
              d="M 76 52 C 64 40 62 22 72 12"
              stroke={copperStroke}
              strokeWidth={sw(1.0)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ delay: 0.12, duration: 0.7, ease: 'easeOut' }}
            />
          </motion.g>

          {/* Right side hair */}
          <motion.g animate={hairBControls} style={{ originX: '120px', originY: '40px' }}>
            <motion.path
              d="M 126 55 C 132 38 130 24 120 18 C 114 14 106 13 100 14"
              stroke={stroke}
              strokeWidth={sw(2)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.09, duration: 0.7, ease: 'easeOut' }}
            />
            {/* flowing strand */}
            <motion.path
              d="M 128 60 C 142 46 144 28 135 16 C 130 10 122 7 115 8"
              stroke={stroke}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ delay: 0.11, duration: 0.8, ease: 'easeOut' }}
            />
          </motion.g>

          {/* ── Face — minimal, expressive ──────────────────────── */}

          {/* Left eye — a thoughtful line-arc */}
          <motion.path
            d="M 86 64 C 88 60 92 60 94 64"
            stroke={stroke}
            strokeWidth={sw(1.8)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
          />
          {/* Right eye */}
          <motion.path
            d="M 106 64 C 108 60 112 60 114 64"
            stroke={stroke}
            strokeWidth={sw(1.8)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.16, duration: 0.35, ease: 'easeOut' }}
          />

          {/* Nose — single curved line, very Pixar */}
          <motion.path
            d="M 100 68 C 102 74 101 78 98 80"
            stroke={stroke}
            strokeWidth={sw(1.4)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.85 }}
            transition={{ delay: 0.17, duration: 0.3, ease: 'easeOut' }}
          />

          {/* Mouth — a gentle upward curve */}
          <motion.path
            d="M 90 90 C 94 96 106 96 110 90"
            stroke={stroke}
            strokeWidth={sw(1.6)}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.4, ease: 'easeOut' }}
          />

          {/* Copper pupil dots — the "soul" of the character */}
          <motion.circle
            cx="89"
            cy="63"
            r="2.2"
            fill={copperStroke}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.3, ...SPRING_SNAPPY }}
            style={{ originX: '89px', originY: '63px' }}
          />
          <motion.circle
            cx="111"
            cy="63"
            r="2.2"
            fill={copperStroke}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.47, duration: 0.3, ...SPRING_SNAPPY }}
            style={{ originX: '111px', originY: '63px' }}
          />
        </motion.g>
      </motion.g>

      {/* ── Copper "in the loop" ring — signature AIC motif ─────── */}
      <motion.circle
        cx="100"
        cy="68"
        r="46"
        stroke={copperStroke}
        strokeWidth={sw(1.0)}
        strokeDasharray="8 12"
        opacity={0}
        initial={{ opacity: 0, rotate: 0 }}
        animate={{ opacity: 0.25, rotate: 360 }}
        transition={{
          opacity: { delay: 1.3, duration: 0.6 },
          rotate: { delay: 1.3, duration: 40, ease: 'linear', repeat: Infinity },
        }}
        style={{ originX: '100px', originY: '68px' }}
      />
    </svg>
  );
}
