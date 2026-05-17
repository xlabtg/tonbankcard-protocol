/**
 * Visual tokens shared by every screen.
 *
 * Light theme only for the initial scaffold; the structure is extensible to
 * dark mode once UX design lands.
 */

export const colors = {
  background: '#0E1116',
  surface: '#161B22',
  surfaceMuted: '#1F242C',
  primary: '#3FA0FF',
  primaryMuted: '#1F4068',
  text: '#F5F8FA',
  textMuted: '#94A3B8',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  border: '#2C313A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  title: 24,
  heading: 18,
  body: 15,
  caption: 12,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
} as const;
