/**
 * utils.ts
 * Helpers utilitaires (cn pour merge Tailwind classes, formatters).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine et déduplique des classes Tailwind.
 * Combine `clsx` (gestion conditionnelle) et `tailwind-merge` (résolution des conflits).
 *
 * @example
 * cn("p-2", isActive && "bg-primary", "p-4") // → "bg-primary p-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
