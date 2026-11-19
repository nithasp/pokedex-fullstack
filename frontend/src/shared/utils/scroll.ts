import type { SmoothScrollOptions } from "@/types/scroll.types";

/**
 * Smooth-scroll helper that mirrors the duration/delay options the original
 * project consumed from `react-scroll`. Uses requestAnimationFrame and an
 * ease-in-out cubic curve so the motion looks identical to the previous
 * implementation without the extra dependency.
 */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const smoothScrollTo = (
  to: number,
  { duration = 500, delay = 0 }: SmoothScrollOptions = {}
): void => {
  if (typeof window === "undefined") return;

  const start = window.scrollY;
  const change = to - start;

  const run = () => {
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      window.scrollTo(0, start + change * eased);
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  if (delay > 0) {
    window.setTimeout(run, delay);
  } else {
    run();
  }
};

/**
 * Freeze page scrolling while a modal is open. The body is padded by the
 * width of the scrollbar that disappears, so the page behind the modal
 * doesn't jump sideways. Returns a function that restores the previous state.
 */
export const lockPageScroll = (): (() => void) => {
  const root = document.documentElement;
  const body = document.body;
  const scrollbarWidth = window.innerWidth - root.clientWidth;
  const previous = {
    overflow: root.style.overflow,
    paddingRight: body.style.paddingRight,
  };

  root.style.overflow = "hidden";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

  return () => {
    root.style.overflow = previous.overflow;
    body.style.paddingRight = previous.paddingRight;
  };
};
