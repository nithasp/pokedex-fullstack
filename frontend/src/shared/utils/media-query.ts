const matches = (query: string): boolean =>
  typeof window !== "undefined" && window.matchMedia(query).matches;

/** The user asked the OS to minimise non-essential motion. */
export const prefersReducedMotion = (): boolean =>
  matches("(prefers-reduced-motion: reduce)");

/**
 * Mouse / trackpad rather than touch. Used to decide whether focusing a text
 * field on open is helpful (desktop) or would pop up the on-screen keyboard.
 */
export const hasFinePointer = (): boolean =>
  matches("(hover: hover) and (pointer: fine)");
