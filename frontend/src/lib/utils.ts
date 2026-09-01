import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Días enteros transcurridos desde `iso` hasta ahora (mínimo 0). Aritmética plana, sin librería de fechas. */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000))
}

/** Formatea el conteo de daysSince en español: 'hoy' | 'hace 1 día' | 'hace N días'. */
export function formatDaysSince(n: number): string {
  return n === 0 ? 'hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`
}
