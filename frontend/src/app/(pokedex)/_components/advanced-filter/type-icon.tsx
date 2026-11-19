import type { ReactNode, SVGProps } from "react";
import type { PokemonTypeName } from "@/types/pokemon.types";

const SNOWFLAKE_ARM = "M12 12V3M12 6.8L9.7 4.5M12 6.8L14.3 4.5";
const SNOWFLAKE_ANGLES = [0, 60, 120, 180, 240, 300];

/**
 * One glyph per pokemon type, drawn on a 24x24 grid in `currentColor`.
 * Cut-outs (eyes, holes, slits) rely on the even-odd fill rule set on the
 * `<svg>` wrapper, so every glyph works on any background colour.
 */
const TYPE_GLYPHS: Record<PokemonTypeName, ReactNode> = {
  normal: (
    <circle
      cx="12"
      cy="12"
      r="6.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.6"
    />
  ),
  grass: (
    <path d="M4.6 19.4C3.6 10.4 9.2 4.4 19.6 4.4C19.8 14.6 14 20.4 4.6 19.4Z M7.5 17.7L15.7 9.2L16.4 9.9L8.3 18.5Z" />
  ),
  fire: (
    <path d="M12.6 2C12.9 5.3 15 7 16.7 9.2C18.1 11 19 12.9 19 15.1C19 18.9 15.9 22 12 22C8.1 22 5 18.9 5 15.1C5 12.6 6.1 10.5 7.8 8.8C8.2 10.3 8.9 11.3 10 12C9.7 8.3 10.6 4.7 12.6 2Z M12 20C13.9 20 15.4 18.6 15.4 16.8C15.4 14.9 14.4 13.2 12.8 12C13 13 13 13.9 12.7 14.8C11.9 14.5 11.3 14 10.7 13C9.6 14.2 8.6 15.2 8.6 16.8C8.6 18.6 10.1 20 12 20Z" />
  ),
  water: (
    <path d="M12 2.5C9.3 6.5 5.6 10.8 5.6 14.9C5.6 18.6 8.4 21.5 12 21.5C15.6 21.5 18.4 18.6 18.4 14.9C18.4 10.8 14.7 6.5 12 2.5Z M8.4 14.7H9.9C9.9 16.1 10.8 17.1 12 17.3V18.9C9.9 18.7 8.4 17 8.4 14.7Z" />
  ),
  electric: <path d="M13.2 2L4.4 13.6H10.3L9.2 22L19.6 9.6H13.3Z" />,
  bug: (
    <>
      <path
        d="M10.4 4.9L8.3 2.6M13.6 4.9L15.7 2.6M7 12.6L4 11.2M6.8 15.6H3.4M7.4 18.6L4.4 20.4M17 12.6L20 11.2M17.2 15.6H20.6M16.6 18.6L19.6 20.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="6.6" r="2.5" />
      <path d="M11.3 9.9C8.5 10.2 6.9 12.4 6.9 15.2C6.9 18.5 8.7 20.9 11.3 21.4Z M12.7 9.9C15.5 10.2 17.1 12.4 17.1 15.2C17.1 18.5 15.3 20.9 12.7 21.4Z" />
    </>
  ),
  flying: (
    <path d="M2.5 13.6C6 6.6 13 3.3 21.5 4.5C20.4 7.4 18.4 9 15.6 9.6C17.4 9.9 18.9 9.7 20.2 9.2C18.7 12.4 16.2 13.9 12.9 14.1C14.5 14.6 15.9 14.6 17.2 14.2C14.6 18.6 8.6 19.8 2.5 13.6Z" />
  ),
  rock: (
    <path d="M7.6 3.6L15.2 4.2L12.6 10.6L4 12.2L4.3 7.4Z M16.6 4.8L21 10.8L18.6 18.6L13.9 11.2Z M12.6 12.2L17.2 19.6L9 20.8L3.6 13.8Z" />
  ),
  poison: (
    <path d="M12 3C7.7 3 4.6 6.1 4.6 10.1C4.6 12.6 5.8 14.5 7.6 15.7V18.1C7.6 18.9 8.2 19.5 9 19.5H10.2V17.3H11.1V19.5H12.9V17.3H13.8V19.5H15C15.8 19.5 16.4 18.9 16.4 18.1V15.7C18.2 14.5 19.4 12.6 19.4 10.1C19.4 6.1 16.3 3 12 3Z M7.1 10.5A1.9 1.9 0 1 0 10.9 10.5A1.9 1.9 0 1 0 7.1 10.5Z M13.1 10.5A1.9 1.9 0 1 0 16.9 10.5A1.9 1.9 0 1 0 13.1 10.5Z M12 12.9L11 14.8H13Z" />
  ),
  ground: (
    <path d="M9.2 5.6H14.8L16.5 9.5H7.5Z M6.9 10.9H17.1L18.8 14.8H5.2Z M4.6 16.2H19.4L21.1 20.1H2.9Z" />
  ),
  ice: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SNOWFLAKE_ANGLES.map((angle) => (
        <path
          key={angle}
          d={SNOWFLAKE_ARM}
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </g>
  ),
  fighting: (
    <>
      <rect x="4.2" y="5.4" width="3.5" height="7.4" rx="1.75" />
      <rect x="8.3" y="4" width="3.5" height="8.8" rx="1.75" />
      <rect x="12.4" y="4.4" width="3.5" height="8.4" rx="1.75" />
      <rect x="16.5" y="5.8" width="3.3" height="7" rx="1.65" />
      <path d="M4.2 14.2H19.8V16.8C19.8 19.1 17.9 21 15.6 21H8.4C6.1 21 4.2 19.1 4.2 16.8V16.6H11.5A0.75 0.75 0 0 0 11.5 15.1H4.2Z" />
    </>
  ),
  psychic: (
    <path d="M2.2 12C4.9 7.3 8.2 5 12 5C15.8 5 19.1 7.3 21.8 12C19.1 16.7 15.8 19 12 19C8.2 19 4.9 16.7 2.2 12Z M8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12Z M10.1 12A1.9 1.9 0 1 0 13.9 12A1.9 1.9 0 1 0 10.1 12Z" />
  ),
  ghost: (
    <path d="M12 2.8C7.9 2.8 5 5.9 5 9.9V21.2L7.35 19.3L9.7 21.2L12 19.3L14.3 21.2L16.65 19.3L19 21.2V9.9C19 5.9 16.1 2.8 12 2.8Z M8 10.3A1.45 1.9 0 1 0 10.9 10.3A1.45 1.9 0 1 0 8 10.3Z M13.1 10.3A1.45 1.9 0 1 0 16 10.3A1.45 1.9 0 1 0 13.1 10.3Z" />
  ),
  dragon: (
    <path d="M12 21.6L7.1 16.7L5.5 10.3L2.6 3.2L8.7 7L12 5.6L15.3 7L21.4 3.2L18.5 10.3L16.9 16.7Z M7.7 10.7L11 12.3L8.7 13.5Z M16.3 10.7L13 12.3L15.3 13.5Z" />
  ),
  dark: <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79Z" />,
  steel: (
    <path d="M12 2.6L20.1 7.3V16.7L12 21.4L3.9 16.7V7.3Z M8.3 12A3.7 3.7 0 1 0 15.7 12A3.7 3.7 0 1 0 8.3 12Z" />
  ),
  fairy: (
    <path d="M10.6 3C11.3 8.3 13.3 10.3 18.6 11C13.3 11.7 11.3 13.7 10.6 19C9.9 13.7 7.9 11.7 2.6 11C7.9 10.3 9.9 8.3 10.6 3Z M18.3 14.4C18.6 16.6 19.4 17.4 21.6 17.7C19.4 18 18.6 18.8 18.3 21C18 18.8 17.2 18 15 17.7C17.2 17.4 18 16.6 18.3 14.4Z" />
  ),
};

interface TypeIconProps extends SVGProps<SVGSVGElement> {
  type: PokemonTypeName;
}

export function TypeIcon({ type, ...props }: TypeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
      focusable="false"
      {...props}
    >
      {TYPE_GLYPHS[type]}
    </svg>
  );
}
