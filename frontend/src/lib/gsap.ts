import { useGSAP } from "@gsap/react";
import gsap from "gsap";

/**
 * Single entry point for GSAP so the React hook is registered exactly once.
 * Import `gsap` / `useGSAP` from here rather than from the packages directly.
 */
gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };
