"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  useId,
  useRef,
} from "react";
import {
  POKEMON_TYPE_NAMES,
  TYPES_COLOR,
  getTypeLabel,
} from "@/config/pokemon-types";
import { gsap, useGSAP } from "@/lib/gsap";
import { MAX_TYPES_PER_POKEMON } from "@/shared/selectors/pokemon-filter.selectors";
import { prefersReducedMotion } from "@/shared/utils/media-query";
import type { TypeFilterProps } from "@/types/advanced-filter.types";
import type { TypeMatchMode } from "@/types/pokemon-filter.types";
import type { PokemonTypeName } from "@/types/pokemon.types";
import { CheckIcon } from "./icons";
import { TypeIcon } from "./type-icon";

const MATCH_MODES: Array<{ value: TypeMatchMode; label: string; hint: string }> =
  [
    {
      value: "any",
      label: "Any",
      hint: "Pokemon with at least one of the selected types",
    },
    {
      value: "all",
      label: "Both",
      hint: "Pokemon that have both selected types",
    },
  ];

export const TypeFilter = memo(function TypeFilter({
  selected,
  matchMode,
  onToggle,
  onMatchModeChange,
}: TypeFilterProps) {
  const rootRef = useRef<HTMLElement>(null);
  const labelId = useId();
  const { contextSafe } = useGSAP({ scope: rootRef });

  // A third type could never match in "both" mode, so the other tiles lock
  // once two are picked.
  const isLimitReached =
    matchMode === "all" && selected.length >= MAX_TYPES_PER_POKEMON;

  const playSelect = contextSafe((tile: HTMLElement) => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      tile.querySelector(".af-tile__gem"),
      { scale: 0.7, rotate: -12 },
      { scale: 1, rotate: 0, duration: 0.65, ease: "elastic.out(1.1, 0.5)" }
    );
    gsap.fromTo(
      tile.querySelector(".af-tile__ring"),
      { scale: 1, opacity: 0.9 },
      { scale: 1.34, opacity: 0, duration: 0.55, ease: "power2.out" }
    );
  });

  const playDeselect = contextSafe((tile: HTMLElement) => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      tile.querySelector(".af-tile__gem"),
      { scale: 0.86, rotate: 0 },
      { scale: 1, duration: 0.3, ease: "power2.out" }
    );
  });

  const playBlocked = contextSafe((tile: HTMLElement) => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      tile,
      { x: -6 },
      {
        x: 0,
        duration: 0.5,
        ease: "elastic.out(1.4, 0.22)",
        clearProps: "transform",
      }
    );
  });

  const handleTileClick = (tile: HTMLElement, type: PokemonTypeName) => {
    const isSelected = selected.includes(type);
    if (!isSelected && isLimitReached) {
      playBlocked(tile);
      return;
    }
    onToggle(type);
    if (isSelected) playDeselect(tile);
    else playSelect(tile);
  };

  // Radio-group keyboard model: arrows move the selection and the focus.
  const handleMatchKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
    const isPrevious = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!isNext && !isPrevious) return;

    event.preventDefault();
    const currentIndex = MATCH_MODES.findIndex(
      (mode) => mode.value === matchMode
    );
    const nextIndex =
      (currentIndex + (isNext ? 1 : -1) + MATCH_MODES.length) %
      MATCH_MODES.length;
    onMatchModeChange(MATCH_MODES[nextIndex].value);
    event.currentTarget
      .querySelectorAll<HTMLElement>('[role="radio"]')
      [nextIndex]?.focus();
  };

  return (
    <section className="af-section" data-anim="section" ref={rootRef}>
      <div className="af-label-row">
        <h3 className="af-label" id={labelId}>
          Type
        </h3>
        <span className="af-rule" aria-hidden />
        <div className="af-match">
          <span aria-hidden>Match</span>
          <div
            className="af-match__track"
            data-mode={matchMode}
            role="radiogroup"
            aria-label="Match selected types"
            onKeyDown={handleMatchKeyDown}
          >
            <span className="af-match__thumb" aria-hidden />
            {MATCH_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                role="radio"
                className="af-match__option"
                aria-checked={matchMode === mode.value}
                tabIndex={matchMode === mode.value ? 0 : -1}
                title={mode.hint}
                onClick={() => onMatchModeChange(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="af-tiles" role="group" aria-labelledby={labelId}>
        {POKEMON_TYPE_NAMES.map((type) => {
          const isSelected = selected.includes(type);
          const isBlocked = isLimitReached && !isSelected;

          return (
            <button
              key={type}
              type="button"
              className="af-tile"
              data-anim="tile"
              aria-pressed={isSelected}
              aria-disabled={isBlocked || undefined}
              title={
                isBlocked
                  ? "A Pokemon has at most two types — deselect one first"
                  : undefined
              }
              style={{ "--type-color": TYPES_COLOR[type] } as CSSProperties}
              onClick={(event) => handleTileClick(event.currentTarget, type)}
            >
              <span className="af-tile__ring" aria-hidden />
              <span className="af-tile__lift">
                <span className="af-tile__gem">
                  <TypeIcon type={type} />
                </span>
              </span>
              <span className="af-tile__label">{getTypeLabel(type)}</span>
              <span className="af-tile__check" aria-hidden>
                <CheckIcon />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
