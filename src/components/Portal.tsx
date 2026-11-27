import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Renders full-screen layers (lightboxes, pop-ups) on <body>.
// Inside an animated section, a "fixed" layer stays trapped in that section instead of covering the screen.
export const Portal = ({ children }: { children: ReactNode }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);
