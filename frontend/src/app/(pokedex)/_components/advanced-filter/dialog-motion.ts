import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/shared/utils/media-query";

/** Below this width the dialog is a bottom sheet (mirrors the CSS breakpoint). */
export const SHEET_QUERY = "(max-width: 639.98px)";

/** Selector for an element tagged for animation with `data-anim`. */
export const anim = (name: string): string => `[data-anim="${name}"]`;

interface EntranceOptions {
  /** Seconds after the panel started to appear. */
  at: number;
  duration: number;
  easing?: string;
  /** Seconds between two elements, or one delay per element. */
  stagger?: number | number[];
}

/**
 * GSAP snaps `px` values to whole pixels by default. The frame's stroke is
 * normalised with `pathLength="1"`, so its dash offset lives between 0 and 1
 * and would jump straight from one end to the other.
 */
const UNROUNDED = { autoRound: false } as const;

/** One frame at 60 Hz, in seconds. */
const FRAME = 1 / 60;
/** The contents never wait longer than this for a frame before they show. */
const CONTENT_FALLBACK_MS = 150;
/** Seconds into the intro at which the light starts circling the frame. */
const ORBIT_START = 1;
const ORBIT_LAP_MS = 8000;
/** Straight steps that stand in for each rounded corner of the lap. */
const ORBIT_CORNER_STEPS = 3;

// GSAP's eases as CSS easings. `power2.out` is exact; the others are the
// usual close matches (ease-out quart, quint, expo and ease-in-out quart).
const POWER2_OUT = "cubic-bezier(0.3333, 1, 0.6667, 1)";
const POWER3_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";
const POWER3_IN_OUT = "cubic-bezier(0.76, 0, 0.24, 1)";
const POWER4_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * GSAP's `back.out(overshoot)` as a CSS easing. That ease is a cubic
 * polynomial, so this Bézier is the very same curve, not an approximation.
 */
const backOut = (overshoot: number): string =>
  `cubic-bezier(0.3333, ${(1 + overshoot / 3).toFixed(4)}, 0.6667, 1)`;

/**
 * Point inside the panel's own box that it grows out of and collapses back
 * into: the centre of the element that opened the dialog. `offsetLeft/Top`
 * ignore transforms, so this stays correct while the panel is mid-animation.
 */
const getTransformOrigin = (
  panel: HTMLElement,
  origin: HTMLElement | null
): string => {
  if (!origin) return "50% 50%";
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2 - panel.offsetLeft;
  const y = rect.top + rect.height / 2 - panel.offsetTop;
  return `${x}px ${y}px`;
};

/**
 * Showing the dialog and painting it for the first time can take a few
 * frames' worth of time. A timeline that is already running would simply skip
 * that much of itself. So its first two frames (the one painted first, and
 * the one after that slow first paint) are held to one frame of progress
 * each, which keeps it in step with the animations the browser starts on the
 * first painted frame.
 */
const startFromFirstPaint = (timeline: gsap.core.Timeline): void => {
  let frames = 0;

  // Runs right after GSAP has rendered a frame, still before it is painted.
  const hold = () => {
    frames += 1;
    if (frames === 2) gsap.ticker.remove(hold);
    if (timeline.isActive() && timeline.time() > frames * FRAME) {
      timeline.time(frames * FRAME);
    }
  };
  gsap.ticker.add(hold);
};

/**
 * Bring elements in, from the given state to their own resting style. This
 * uses the Web Animations API rather than GSAP: nothing has to be measured to
 * start one (GSAP reads the computed style of every target, and each of those
 * reads recalculates styles), the compositor plays them even while the main
 * thread is busy, and they leave no inline styles behind.
 */
const enter = (
  elements: Element[],
  from: Keyframe,
  { at, duration, easing = POWER3_OUT, stagger = 0 }: EntranceOptions
): void => {
  elements.forEach((element, index) => {
    const wait = typeof stagger === "number" ? stagger * index : stagger[index];
    element.animate([from, { transform: "none" }], {
      delay: (at + wait) * 1000,
      duration: duration * 1000,
      easing,
      // Hold the starting state until it is this element's turn.
      fill: "backwards",
    });
  });
};

/**
 * Stop an element's entrance where it currently is and keep it there, so
 * that a tween can take over from that very state.
 */
const settle = (element: Element): void => {
  for (const animation of element.getAnimations()) {
    try {
      animation.commitStyles();
    } catch {
      // Not rendered (any more): there is no state worth keeping.
    }
    animation.cancel();
  }
};

/**
 * Delays that sweep over a grid of elements diagonally, starting from its
 * first cell (what GSAP's `grid: "auto"` stagger does). `each` is the time
 * between two neighbouring cells along the longer side.
 */
const getGridDelays = (elements: HTMLElement[], each: number): number[] => {
  if (elements.length === 0) return [];

  const firstRowTop = elements[0].offsetTop;
  const columns = elements.filter(
    (element) => element.offsetTop === firstRowTop
  ).length;
  const rows = Math.ceil(elements.length / columns);
  const distances = elements.map((_element, index) =>
    Math.hypot(index % columns, Math.floor(index / columns))
  );
  const farthest = Math.max(...distances) || 1;
  const spread = each * Math.max(columns, rows);
  return distances.map((distance) => (distance / farthest) * spread);
};

/**
 * Send the light on its endless lap around the frame. Each element here is as
 * large as the panel and carries a light on its top-left corner, so moving it
 * by its own size walks that light along the border. On the compositor like
 * the entrances above: no script, layout or paint while the dialog is open.
 */
const startOrbit = (panel: HTMLElement, carriers: Element[]): void => {
  const { offsetWidth: width, offsetHeight: height } = panel;
  if (width === 0 || height === 0) return;

  const radius = Math.min(
    parseFloat(getComputedStyle(panel).getPropertyValue("--af-radius")) || 0,
    width / 2,
    height / 2
  );
  // Clockwise from the top right. Per corner: the percentages that place it,
  // the angle its arc starts at, and the straight edge that leads up to it.
  const corners = [
    { x: 100, y: 0, from: -90, edge: width - 2 * radius },
    { x: 100, y: 100, from: 0, edge: height - 2 * radius },
    { x: 0, y: 100, from: 90, edge: width - 2 * radius },
    { x: 0, y: 0, from: 180, edge: height - 2 * radius },
  ];
  const arcStep = (Math.PI * radius) / 2 / ORBIT_CORNER_STEPS;
  const lapLength = 2 * (width + height) + (2 * Math.PI - 8) * radius;

  // Percentages follow the panel if it is resized; only the corner arcs are
  // in pixels. A corner's centre lies one radius inside the panel.
  const pointAt = (corner: (typeof corners)[number], degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    const x = (corner.x === 0 ? radius : -radius) + radius * Math.cos(angle);
    const y = (corner.y === 0 ? radius : -radius) + radius * Math.sin(angle);
    return `translate(calc(${corner.x}% + ${x.toFixed(2)}px), calc(${corner.y}% + ${y.toFixed(2)}px))`;
  };

  // Keyframes are spaced by distance, so the light keeps one speed all the
  // way round. It sets off where the top edge starts, like the line before it.
  const lap: Keyframe[] = [{ transform: pointAt(corners[3], 270), offset: 0 }];
  let travelled = 0;
  for (const corner of corners) {
    for (let step = 0; step <= ORBIT_CORNER_STEPS; step++) {
      travelled += step === 0 ? corner.edge : arcStep;
      lap.push({
        transform: pointAt(
          corner,
          corner.from + (90 * step) / ORBIT_CORNER_STEPS
        ),
        offset: Math.min(travelled / lapLength, 1),
      });
    }
  }
  lap[lap.length - 1].offset = 1;

  for (const carrier of carriers) {
    carrier.animate(lap, {
      duration: ORBIT_LAP_MS,
      delay: ORBIT_START * 1000,
      iterations: Infinity,
    });
  }
};

/**
 * Entrance of the dialog. On desktop the panel grows out of the button that
 * opened it while a line of light draws its frame and a scanner sweeps down;
 * on phones it slides up as a sheet. Either way the content then cascades in:
 * title letter by letter, type tiles in a diagonal wave, and so on.
 *
 * It is built to put something on screen at once. The first frame only holds
 * the bare panel, which is cheap to paint; the contents follow two frames
 * later (`onContentShown`), and since the panel grows on the compositor, it
 * keeps moving while they are being prepared. Whatever only moves or fades
 * is left to the browser (see `enter`); GSAP sequences the line of light,
 * the scanner and the hand-over to the idle state.
 *
 * Call it inside a GSAP context (`useGSAP`) so that part is cleaned up with
 * the component.
 */
export const playDialogIntro = (
  dialog: HTMLDialogElement,
  panel: HTMLElement,
  origin: HTMLElement | null,
  onContentShown: () => void
): gsap.core.Timeline => {
  const select = gsap.utils.selector(dialog);
  // CSS hides the contents until the intro is "playing", keeps every animated
  // piece on its own compositor layer while it is, and only switches on the
  // state transitions that would fight the entrances once it is "done".
  const showContent = () => {
    dialog.dataset.intro = "playing";
    onContentShown();
  };
  const markDone = () => {
    dialog.dataset.intro = "done";
  };
  const timeline = gsap.timeline();
  startFromFirstPaint(timeline);

  if (prefersReducedMotion()) {
    showContent();
    return timeline
      .fromTo(
        [...select(anim("backdrop")), panel],
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "none" }
      )
      .call(markDone);
  }

  const isSheet = window.matchMedia(SHEET_QUERY).matches;
  const start = isSheet ? 0.14 : 0.1;
  const end = start + 1.15;

  // Everything that needs measuring is read first: once styles have been
  // written, each further read would make the browser recalculate them.
  const tiles: HTMLElement[] = select(anim("tile"));
  const regions: HTMLElement[] = select(anim("region"));
  const tileDelays = getGridDelays(tiles, 0.018);
  const regionDelays = getGridDelays(regions, 0.03);
  const panelHeight = panel.offsetHeight;
  const transformOrigin = getTransformOrigin(panel, origin);
  if (!isSheet) startOrbit(panel, select(anim("orbit-carrier")));

  for (const backdrop of select(anim("backdrop")) as Element[]) {
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 400,
      easing: POWER2_OUT,
    });
  }
  if (!isSheet) panel.style.transformOrigin = transformOrigin;
  const panelEntrance = isSheet
    ? panel.animate(
        [{ transform: "translateY(100%)" }, { transform: "none" }],
        { duration: 550, easing: POWER4_OUT }
      )
    : panel.animate(
        [
          { opacity: 0, transform: "scale(0.45)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 600, easing: EXPO_OUT }
      );

  let hasContent = false;
  const startCascade = () => {
    if (hasContent || !dialog.open) return;
    hasContent = true;
    showContent();

    // The cascade keeps its place on the panel's clock, which has been
    // running for a frame or two by now.
    const at = start - (Number(panelEntrance.currentTime) || 0) / 1000;
    enter(
      select(anim("tab")),
      { transform: "translateX(-30%)", opacity: 0 },
      { at, duration: 0.5 }
    );
    enter(
      select(anim("title-char")),
      { transform: "translateY(80%) rotate(12deg)", opacity: 0 },
      { at: at + 0.12, duration: 0.5, easing: backOut(2), stagger: 0.022 }
    );
    enter(
      select(anim("close")),
      { transform: "rotate(-120deg) scale(0)" },
      { at: at + 0.2, duration: 0.5, easing: backOut(2) }
    );
    enter(
      select(anim("section")),
      { transform: "translateY(22px)", opacity: 0 },
      { at: at + 0.08, duration: 0.45, stagger: 0.06 }
    );
    enter(
      tiles,
      { transform: "scale(0.5)", opacity: 0 },
      {
        at: at + 0.2,
        duration: 0.42,
        easing: backOut(1.8),
        stagger: tileDelays,
      }
    );
    enter(
      regions,
      { transform: "translateX(-14px)", opacity: 0 },
      { at: at + 0.3, duration: 0.38, stagger: regionDelays }
    );
    enter(
      select(anim("range-fill")),
      { transform: "scaleX(0)" },
      { at: at + 0.38, duration: 0.55, easing: POWER3_IN_OUT }
    );
    enter(
      select(anim("range-thumb")),
      { transform: "scale(0)" },
      { at: at + 0.5, duration: 0.4, easing: backOut(2.6), stagger: 0.08 }
    );
    enter(
      select(anim("footer")),
      { transform: "translateY(18px)", opacity: 0 },
      { at: at + 0.28, duration: 0.42 }
    );
  };
  // Two frames from now the bare panel has been painted. Frames can stall
  // (a tab in the background), and the contents must not wait for them.
  requestAnimationFrame(() => requestAnimationFrame(startCascade));
  window.setTimeout(startCascade, CONTENT_FALLBACK_MS);

  if (!isSheet) {
    timeline
      // A bright line draws itself around the frame, then melts into the border.
      .fromTo(
        select(anim("trace")),
        { strokeDashoffset: 1, opacity: 1 },
        {
          strokeDashoffset: 0,
          duration: 0.9,
          ease: "power2.inOut",
          ...UNROUNDED,
        },
        0.12
      )
      .to(
        select(anim("trace")),
        { opacity: 0, duration: 0.5, ease: "power1.out" },
        0.95
      )
      // The line repaints its whole layer on every frame it moves, so that
      // layer goes away as soon as the line has faded.
      .set(select(anim("frame")), { display: "none" }, 1.45)
      // One scanner pass from top to bottom.
      .fromTo(
        select(anim("scan")),
        { y: -110, opacity: 1 },
        { y: panelHeight, duration: 0.85, ease: "power1.in" },
        0.15
      )
      .set(select(anim("scan")), { opacity: 0 }, 1)
      // Where the line ended, a light sets off around the frame.
      .to(
        select(anim("orbit")),
        { opacity: 1, duration: 0.8, ease: "power1.out" },
        ORBIT_START
      );
  }

  return timeline.call(markDone, undefined, end);
};

/**
 * Exit of the dialog: the reverse gesture of the intro, only quicker. The
 * returned timeline calls `onComplete` when the dialog can really be closed.
 */
export const playDialogOutro = (
  dialog: HTMLDialogElement,
  panel: HTMLElement,
  origin: HTMLElement | null,
  onComplete: () => void
): gsap.core.Timeline => {
  const backdrop: Element[] = gsap.utils.selector(dialog)(anim("backdrop"));
  const timeline = gsap.timeline({ onComplete });

  // Closed in the middle of its entrance, the dialog leaves from wherever
  // that had brought it.
  [panel, ...backdrop].forEach(settle);

  if (prefersReducedMotion()) {
    return timeline.to([...backdrop, panel], {
      opacity: 0,
      duration: 0.15,
      ease: "none",
    });
  }

  if (window.matchMedia(SHEET_QUERY).matches) {
    timeline.to(panel, { yPercent: 100, duration: 0.32, ease: "power3.in" }, 0);
  } else {
    gsap.set(panel, { transformOrigin: getTransformOrigin(panel, origin) });
    timeline.to(
      panel,
      { opacity: 0, scale: 0.6, duration: 0.3, ease: "power3.in" },
      0
    );
  }
  return timeline.to(
    backdrop,
    { opacity: 0, duration: 0.3, ease: "power2.in" },
    0.04
  );
};
