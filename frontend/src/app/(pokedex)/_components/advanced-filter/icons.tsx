import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function StrokeIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M20 20L15.4 15.4" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 6L18 18M18 6L6 18" />
    </StrokeIcon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M3.5 6H20.5M3.5 12H20.5M3.5 18H20.5" />
      <g fill="currentColor">
        <circle className="af-knob af-knob--1" cx="15" cy="6" r="1.7" />
        <circle className="af-knob af-knob--2" cx="8.5" cy="12" r="1.7" />
        <circle className="af-knob af-knob--3" cx="16" cy="18" r="1.7" />
      </g>
    </StrokeIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 9.5L12 15.5L18 9.5" />
    </StrokeIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M5 12.6L9.6 17.2L19 7.4" />
    </StrokeIcon>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M3 4.5V10H8.5" />
      <path d="M5.1 15A8 8 0 1 0 7 6.7L3 10" />
    </StrokeIcon>
  );
}
