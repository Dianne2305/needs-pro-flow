/**
 * utils.ts
 * Helpers utilitaires (cn pour merge Tailwind classes, formatters).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
