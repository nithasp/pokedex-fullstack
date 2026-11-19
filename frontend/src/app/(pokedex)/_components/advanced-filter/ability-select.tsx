"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { gsap, useGSAP } from "@/lib/gsap";
import {
  findMatchRange,
  formatAbilityName,
  searchAbilityOptions,
} from "@/shared/selectors/pokemon-filter.selectors";
import { hasFinePointer, prefersReducedMotion } from "@/shared/utils/media-query";
import type { AbilitySelectProps } from "@/types/advanced-filter.types";
import { CheckIcon, ChevronDownIcon, CloseIcon, SearchIcon } from "./icons";

/**
 * Element inside the dialog that popovers are portalled into. It sits outside
 * the panel, so the panel's scrolling body can't clip them, but inside the
 * `<dialog>`, so they stay in the top layer and reachable (everything outside
 * a modal dialog is inert).
 */
export const PopoverLayerContext = createContext<HTMLElement | null>(null);

interface PopoverPlacement {
  side: "top" | "bottom";
  style: CSSProperties;
}

const PLACEHOLDER = "All abilities";
const POPOVER_GAP = 8;
const POPOVER_MARGIN = 12;
const POPOVER_MIN_HEIGHT = 230;
const POPOVER_MAX_HEIGHT = 384;
/** Opening downward is preferred when at least this much room is available. */
const POPOVER_COMFORT_HEIGHT = 300;
const PAGE_JUMP = 8;
const LIST_PADDING = 6;
const STAGGER_ROWS = 12;
/** Space between two tags, and the room the "+N" badge takes (mirror the CSS). */
const TAG_GAP = 6;
const MORE_BADGE_WIDTH = 40;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

function HighlightedLabel({ label, term }: { label: string; term: string }) {
  const range = findMatchRange(label, term);
  if (!range) return <>{label}</>;
  return (
    <>
      {label.slice(0, range[0])}
      <mark>{label.slice(range[0], range[1])}</mark>
      {label.slice(range[1])}
    </>
  );
}

/**
 * Multi-select for abilities: the field shows the picks as removable tags, and
 * its popover is a searchable list that stays open while abilities are ticked.
 */
export const AbilitySelect = memo(function AbilitySelect({
  options,
  selected,
  pokemonCount,
  onToggle,
  onClear,
}: AbilitySelectProps) {
  const layer = useContext(PopoverLayerContext);
  const labelId = useId();
  const summaryId = useId();
  const hintId = useId();
  const listboxId = useId();

  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isClosingRef = useRef(false);

  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  /** The selection as it was when the popover opened. */
  const [pinned, setPinned] = useState<string[]>([]);
  /** How many tags fit on the field's single line. */
  const [fitCount, setFitCount] = useState(Number.POSITIVE_INFINITY);
  const isOpen = placement !== null;
  const hiddenTagCount = Math.max(selected.length - fitCount, 0);

  // What is already selected is listed first, so it can be reviewed without
  // scrolling through every ability. The order is fixed when the popover
  // opens: rows never jump around while they are being ticked.
  const { rows, pinnedCount } = useMemo(() => {
    const matches = searchAbilityOptions(options, term);
    if (term.trim() || pinned.length === 0) {
      return { rows: matches, pinnedCount: 0 };
    }

    const pinnedRows = matches.filter((option) => pinned.includes(option.value));
    return {
      rows: [
        ...pinnedRows,
        ...matches.filter((option) => !pinned.includes(option.value)),
      ],
      pinnedCount: pinnedRows.length,
    };
  }, [options, term, pinned]);

  const rowId = (index: number): string => `${listboxId}-${index}`;

  /** Scroll the list just far enough to reveal a row (never the page). */
  const revealRow = (index: number) => {
    const list = listRef.current;
    const row = list?.children[index] as HTMLElement | undefined;
    if (!list || !row) return;

    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop + LIST_PADDING) {
      list.scrollTop = top - LIST_PADDING;
    } else if (bottom > list.scrollTop + list.clientHeight - LIST_PADDING) {
      list.scrollTop = bottom - list.clientHeight + LIST_PADDING;
    }
  };

  // The tags share one line. When they don't all fit, the last ones make way
  // for a "+N" badge; those stay in the DOM, hidden, so they can be measured.
  const measureTags = useCallback(() => {
    const content = contentRef.current;
    const list = tagsRef.current;
    // Nothing to measure without tags, or before the dialog is displayed.
    if (!content || !list || content.clientWidth === 0) return;

    const style = getComputedStyle(content);
    const available =
      content.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const widths = Array.from(
      list.children,
      (tag) => (tag as HTMLElement).offsetWidth
    );
    const total =
      widths.reduce((sum, width) => sum + width, 0) +
      TAG_GAP * (widths.length - 1);
    if (total <= available) {
      setFitCount(widths.length);
      return;
    }

    // The first tag always shows; any further one must leave room for the badge.
    let used = widths[0];
    let fit = 1;
    while (
      fit < widths.length &&
      used + TAG_GAP + widths[fit] + TAG_GAP + MORE_BADGE_WIDTH <= available
    ) {
      used += TAG_GAP + widths[fit];
      fit += 1;
    }
    setFitCount(fit);
  }, []);

  useLayoutEffect(measureTags, [measureTags, selected]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(measureTags);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measureTags]);

  const { contextSafe } = useGSAP(
    () => {
      const popover = popoverRef.current;
      if (!placement || !popover) return;

      isClosingRef.current = false;

      // On touch screens focusing the search box would summon the on-screen
      // keyboard over the list, so the popover itself takes focus there.
      if (hasFinePointer()) searchRef.current?.focus({ preventScroll: true });
      else popover.focus({ preventScroll: true });

      if (prefersReducedMotion()) return;
      const opensUpward = placement.side === "top";
      gsap.fromTo(
        popover,
        {
          opacity: 0,
          y: opensUpward ? 10 : -10,
          scale: 0.96,
          transformOrigin: opensUpward ? "50% 100%" : "50% 0%",
        },
        { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "power3.out" }
      );
      // Only the first rows are on screen; staggering all of them would leave
      // the far ones invisible for seconds.
      gsap.fromTo(
        Array.from(popover.querySelectorAll(".af-option")).slice(
          0,
          STAGGER_ROWS
        ),
        { opacity: 0, x: -10 },
        {
          opacity: 1,
          x: 0,
          duration: 0.24,
          ease: "power2.out",
          stagger: 0.018,
          clearProps: "transform,opacity",
        }
      );
    },
    // Opening is the only thing that should (re)run the entrance.
    { dependencies: [isOpen] }
  );

  // The field can move out from under the popover when the viewport changes,
  // so a resize simply dismisses it.
  useEffect(() => {
    if (!isOpen) return;
    const dismiss = () => setPlacement(null);
    window.addEventListener("resize", dismiss);
    return () => window.removeEventListener("resize", dismiss);
  }, [isOpen]);

  const open = () => {
    const field = fieldRef.current;
    if (!field || !layer) return;

    const bounds = layer.getBoundingClientRect();
    const rect = field.getBoundingClientRect();
    const spaceBelow = bounds.bottom - rect.bottom - POPOVER_GAP - POPOVER_MARGIN;
    const spaceAbove = rect.top - bounds.top - POPOVER_GAP - POPOVER_MARGIN;
    const side =
      spaceBelow >= POPOVER_COMFORT_HEIGHT || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";

    setTerm("");
    setPinned(selected);
    setActiveIndex(0);
    setPlacement({
      side,
      style: {
        left: rect.left - bounds.left,
        width: rect.width,
        maxHeight: clamp(
          side === "bottom" ? spaceBelow : spaceAbove,
          POPOVER_MIN_HEIGHT,
          POPOVER_MAX_HEIGHT
        ),
        ...(side === "bottom"
          ? { top: rect.bottom - bounds.top + POPOVER_GAP }
          : { bottom: bounds.bottom - rect.top + POPOVER_GAP }),
      },
    });
  };

  const close = contextSafe(() => {
    const popover = popoverRef.current;
    if (!popover || !placement || isClosingRef.current) return;

    isClosingRef.current = true;
    triggerRef.current?.focus({ preventScroll: true });

    if (prefersReducedMotion()) {
      setPlacement(null);
      return;
    }
    gsap.to(popover, {
      opacity: 0,
      y: placement.side === "top" ? 8 : -8,
      scale: 0.97,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => setPlacement(null),
    });
  });

  // A removed tag takes its button along, and "clear all" hides itself: both
  // hand keyboard focus back to the field instead of dropping it.
  const removeTag = (ability: string) => {
    onToggle(ability);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const clearAll = () => {
    onClear();
    triggerRef.current?.focus({ preventScroll: true });
  };

  const moveActive = (delta: number) => {
    if (rows.length === 0) return;
    const next = clamp(activeIndex + delta, 0, rows.length - 1);
    setActiveIndex(next);
    revealRow(next);
  };

  const handleTermChange = (next: string) => {
    setTerm(next);
    setActiveIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const handlePopoverKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "PageDown":
        event.preventDefault();
        moveActive(PAGE_JUMP);
        break;
      case "PageUp":
        event.preventDefault();
        moveActive(-PAGE_JUMP);
        break;
      case "Enter": {
        // Ticks the highlighted ability; the list stays open for the next one.
        event.preventDefault();
        const row = rows[activeIndex];
        if (row) onToggle(row.value);
        break;
      }
      case "Escape":
        // Escape belongs to the popover first; the dialog stays open.
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        event.preventDefault();
        close();
        break;
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isOpen || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    open();
  };

  const labels = selected.map(formatAbilityName);
  const summary =
    labels.length === 0
      ? PLACEHOLDER
      : labels.length === 1
        ? labels[0]
        : `${labels.length} selected: ${labels.join(", ")}`;
  const verb = pokemonCount === 1 ? "has" : "have";
  const hint =
    selected.length === 0
      ? `${options.length} abilities to choose from`
      : selected.length === 1
        ? `${pokemonCount} Pokemon ${verb} this ability`
        : `${pokemonCount} Pokemon ${verb} at least one of these`;

  return (
    <section className="af-section" data-anim="section">
      <div className="af-label-row">
        <h3 className="af-label" id={labelId}>
          Ability
        </h3>
        <span className="af-rule" aria-hidden />
      </div>

      <div
        className="af-select"
        ref={fieldRef}
        data-open={isOpen}
        data-filled={selected.length > 0}
      >
        <button
          ref={triggerRef}
          type="button"
          className="af-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-labelledby={`${labelId} ${summaryId}`}
          aria-describedby={hintId}
          onClick={() => (isOpen ? close() : open())}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="sr-only" id={summaryId}>
            {summary}
          </span>
        </button>

        <div className="af-select__content" ref={contentRef}>
          {selected.length === 0 ? (
            <span className="af-select__placeholder" aria-hidden>
              {PLACEHOLDER}
            </span>
          ) : (
            <>
              <ul
                className="af-select__tags"
                ref={tagsRef}
                aria-label="Selected abilities"
              >
                {selected.map((ability, index) => (
                  <li
                    key={ability}
                    className="af-tag"
                    data-overflow={index >= fitCount || undefined}
                  >
                    <span className="af-tag__label">{labels[index]}</span>
                    <button
                      type="button"
                      className="af-tag__remove"
                      aria-label={`Remove ${labels[index]}`}
                      onClick={() => removeTag(ability)}
                    >
                      <CloseIcon />
                    </button>
                  </li>
                ))}
              </ul>
              {hiddenTagCount > 0 && (
                // Keyed by the count, so the badge pops again when it changes.
                <span
                  className="af-select__more"
                  key={hiddenTagCount}
                  aria-hidden
                >
                  +{hiddenTagCount}
                </span>
              )}
            </>
          )}
        </div>

        {selected.length > 1 && (
          <button
            type="button"
            className="af-icon-button af-select__clear"
            aria-label="Clear all abilities"
            onClick={clearAll}
          >
            <CloseIcon />
          </button>
        )}
        <span className="af-select__chevron" aria-hidden>
          <ChevronDownIcon />
        </span>
      </div>
      <p className="af-hint" id={hintId}>
        {hint}
      </p>

      {placement &&
        layer &&
        createPortal(
          <>
            <div className="af-popover-scrim" onClick={close} />
            <div
              className="af-popover"
              ref={popoverRef}
              style={placement.style}
              tabIndex={-1}
              onKeyDown={handlePopoverKeyDown}
            >
              <div className="af-popover__search">
                <SearchIcon />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search abilities"
                  aria-expanded
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    rows.length > 0 ? rowId(activeIndex) : undefined
                  }
                  placeholder={`Search ${options.length} abilities`}
                  value={term}
                  onChange={(event) => handleTermChange(event.target.value)}
                />
              </div>
              <ul
                className="af-popover__list"
                id={listboxId}
                ref={listRef}
                role="listbox"
                aria-multiselectable
                aria-labelledby={labelId}
              >
                {rows.map((row, index) => (
                  <li
                    key={row.value}
                    id={rowId(index)}
                    className="af-option"
                    role="option"
                    aria-selected={selected.includes(row.value)}
                    data-active={index === activeIndex}
                    data-group-end={
                      (index === pinnedCount - 1 && index < rows.length - 1) ||
                      undefined
                    }
                    // Keep focus in the search box while clicking a row.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => {
                      if (index !== activeIndex) setActiveIndex(index);
                    }}
                    onClick={() => onToggle(row.value)}
                  >
                    <span className="af-option__box" aria-hidden>
                      <CheckIcon />
                    </span>
                    <span className="af-option__label">
                      <HighlightedLabel label={row.label} term={term} />
                    </span>
                    <span className="af-option__count">{row.count}</span>
                  </li>
                ))}
                {rows.length === 0 && (
                  <li className="af-popover__empty" role="presentation">
                    No ability matches “{term.trim()}”
                  </li>
                )}
              </ul>
              {/* Pointer shortcuts: from the keyboard, Escape is "done" and the
                  field's own button clears. */}
              <div className="af-popover__footer">
                <span className="af-popover__status">
                  {selected.length === 0
                    ? "None selected"
                    : `${selected.length} selected`}
                </span>
                <button
                  type="button"
                  className="af-popover__action af-popover__action--ghost"
                  tabIndex={-1}
                  aria-disabled={selected.length === 0 || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onClear}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="af-popover__action af-popover__action--primary"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={close}
                >
                  Done
                </button>
              </div>
            </div>
          </>,
          layer
        )}
    </section>
  );
});
