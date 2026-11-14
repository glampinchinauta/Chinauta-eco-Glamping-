import React from 'react';
import { motion, type Variants } from 'framer-motion';

/**
 * Animaciones de entrada al hacer scroll. Solo usan opacidad y movimiento (rápidas y suaves en el celular).
 * Si la persona tiene activado "reducir movimiento" en su dispositivo, <MotionConfig reducedMotion="user"> (en App)
 * quita el desplazamiento y deja solo el cambio de opacidad.
 */
const EASE = [0.22, 1, 0.36, 1] as const; // salida suave, sin rebote

const fadeUp = (distance: number, duration: number): Variants => ({
  hidden: { opacity: 0, y: distance },
  show: { opacity: 1, y: 0, transition: { duration, ease: EASE } },
});

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Retraso en segundos (para escalonar elementos). */
  delay?: number;
  /** Distancia del desplazamiento inicial en px. */
  distance?: number;
  as?: 'div' | 'section' | 'li';
}

/** Aparece suavemente (sube y se desvanece) la primera vez que entra en pantalla. */
export const Reveal: React.FC<RevealProps> = ({ children, delay = 0, distance = 28, as = 'div', ...rest }) => {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      variants={fadeUp(distance, 0.7)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ delay }}
      {...(rest as any)}
    >
      {children}
    </Tag>
  );
};

/** Contenedor que hace aparecer a sus <RevealItem> uno tras otro. */
export const RevealGroup: React.FC<React.HTMLAttributes<HTMLDivElement> & { stagger?: number }> = ({ children, stagger = 0.09, ...rest }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    {...(rest as any)}
  >
    {children}
  </motion.div>
);

export const RevealItem: React.FC<React.HTMLAttributes<HTMLDivElement> & { distance?: number }> = ({ children, distance = 32, ...rest }) => (
  <motion.div variants={fadeUp(distance, 0.7)} {...(rest as any)}>
    {children}
  </motion.div>
);
