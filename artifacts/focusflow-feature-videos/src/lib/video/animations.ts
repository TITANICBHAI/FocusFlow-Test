import type { Transition, Variants } from 'framer-motion';

export const springs = {
  snappy: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  bouncy: { type: 'spring', stiffness: 300, damping: 15 } as Transition,
  gentle: { type: 'spring', stiffness: 100, damping: 20 } as Transition,
  smooth: { type: 'spring', stiffness: 120, damping: 25 } as Transition,
  poppy: { type: 'spring', stiffness: 500, damping: 22 } as Transition,
} as const;

export const easings = {
  easeOut: { ease: [0.16, 1, 0.3, 1] } as Transition,
  circOut: { ease: 'circOut' } as Transition,
  easeInOut: { ease: [0.4, 0, 0.2, 1] } as Transition,
} as const;

export const sceneTransitions = {
  scaleFade: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05, filter: 'blur(10px)' },
    transition: { duration: 0.7, ease: 'circOut' },
  },
  wipe: {
    initial: { clipPath: 'inset(0 100% 0 0)' },
    animate: { clipPath: 'inset(0 0% 0 0)' },
    exit: { clipPath: 'inset(0 0 0 100%)' },
    transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
  },
  clipCircle: {
    initial: { clipPath: 'circle(0% at 50% 50%)' },
    animate: { clipPath: 'circle(100% at 50% 50%)' },
    exit: { clipPath: 'circle(0% at 50% 50%)' },
    transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] },
  },
  splitHorizontal: {
    initial: { clipPath: 'inset(50% 0 50% 0)' },
    animate: { clipPath: 'inset(0% 0 0% 0)' },
    exit: { clipPath: 'inset(50% 0 50% 0)' },
    transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
  },
  morphExpand: {
    initial: { opacity: 0, scale: 0.3, borderRadius: '50%' },
    animate: { opacity: 1, scale: 1, borderRadius: '0%' },
    exit: { opacity: 0, scale: 2.5, filter: 'blur(30px)' },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
  },
  perspectiveFlip: {
    initial: { opacity: 0, rotateY: -90, transformPerspective: 1200 },
    animate: { opacity: 1, rotateY: 0, transformPerspective: 1200 },
    exit: { opacity: 0, rotateY: 90, transformPerspective: 1200 },
    transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
  },
  zoomThrough: {
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.5 },
    transition: { duration: 1, ease: 'circOut' },
  },
  fadeBlur: {
    initial: { opacity: 0, filter: 'blur(20px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(20px)' },
    transition: { duration: 0.8, ease: 'circOut' },
  },
} as const;

export const charVariants: Variants = {
  hidden: { opacity: 0, y: 40, rotateX: -40, transformPerspective: 800 },
  visible: { opacity: 1, y: 0, rotateX: 0, transformPerspective: 800,
    transition: { type: 'spring', stiffness: 400, damping: 25 } },
};
export const charContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.1 } },
};
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'circOut' } },
};
export function staggerDelay(index: number, base = 0.1) { return index * base; }
export function customSpring(stiffness: number, damping: number): Transition { return { type: 'spring', stiffness, damping }; }
export function withDelay(t: Transition, delay: number): Transition { return { ...t, delay }; }
export const elementAnimations = {
  fadeUp: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: 'circOut' } },
  blurIn: { initial: { opacity: 0, filter: 'blur(20px)' }, animate: { opacity: 1, filter: 'blur(0px)' }, transition: { duration: 0.6, ease: 'circOut' } },
  popIn: { initial: { opacity: 0, scale: 0 }, animate: { opacity: 1, scale: 1 }, transition: { type: 'spring', stiffness: 300, damping: 20 } },
} as const;
export const staggerConfigs = {
  fast: { staggerChildren: 0.05, delayChildren: 0 },
  medium: { staggerChildren: 0.1, delayChildren: 0.1 },
  charFast: { staggerChildren: 0.02, delayChildren: 0 },
} as const;
