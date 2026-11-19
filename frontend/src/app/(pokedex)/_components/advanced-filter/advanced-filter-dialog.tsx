"use client";

import {
  type FormEvent,
  type SyntheticEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import {
  DEFAULT_POKEMON_FILTERS,
  MAX_TYPES_PER_POKEMON,
  arePokemonFiltersEqual,
  collectAbilityOptions,
  filterPokemon,
  getAvailableRegions,
  getDexBounds,
  normalizePokemonFilters,
} from "@/shared/selectors/pokemon-filter.selectors";
import { hasFinePointer, prefersReducedMotion } from "@/shared/utils/media-query";
import { lockPageScroll } from "@/shared/utils/scroll";
import { usePokemonList, useSetPokemonFilters } from "@/stores";
import type { AdvancedFilterDialogProps } from "@/types/advanced-filter.types";
import type {
  PokemonFilters,
  PokemonIdRange,
  PokemonRegionId,
  TypeMatchMode,
} from "@/types/pokemon-filter.types";
import type { PokemonTypeName } from "@/types/pokemon.types";
import { AbilitySelect, PopoverLayerContext } from "./ability-select";
import { DexRangeSlider } from "./dex-range-slider";
import {
  SHEET_QUERY,
  anim,
  playDialogIntro,
  playDialogOutro,
} from "./dialog-motion";
import { CloseIcon, ResetIcon, SearchIcon, SlidersIcon } from "./icons";
import { RegionFilter } from "./region-filter";
import { TypeFilter } from "./type-filter";

const TITLE = "Search in Detail";
const SEARCH_LABEL = "Search by name or Pokedex number";
/** The full label doesn't fit the search field of a phone-width sheet. */
const SEARCH_LABEL_SHORT = "Name or Pokedex number";
const COUNT_ANNOUNCE_DELAY_MS = 600;

/** Add the item to the selection, or take it out if it is already there. */
const toggleItem = <T,>(items: T[], item: T): T[] =>
  items.includes(item)
    ? items.filter((entry) => entry !== item)
    : [...items, item];

/**
 * The dialog itself. It is rendered as soon as its code has loaded and waits
 * closed, so that a click only has to show and animate it; each instance is
 * used for a single opening.
 */
export const AdvancedFilterDialog = memo(function AdvancedFilterDialog({
  initialFilters,
  originRef,
  onClosed,
}: AdvancedFilterDialogProps) {
  const allPokemon = usePokemonList();
  const setFilters = useSetPokemonFilters();
  const isOpen = initialFilters !== null;

  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const introRef = useRef<gsap.core.Timeline | null>(null);
  const countTweenRef = useRef<gsap.core.Tween | null>(null);
  const isClosingRef = useRef(false);
  const [popoverLayer, setPopoverLayer] = useState<HTMLDivElement | null>(null);
  const searchPlaceholder = window.matchMedia(SHEET_QUERY).matches
    ? SEARCH_LABEL_SHORT
    : SEARCH_LABEL;

  const bounds = useMemo(() => getDexBounds(allPokemon), [allPokemon]);
  const regions = useMemo(() => getAvailableRegions(bounds), [bounds]);
  const abilityOptions = useMemo(
    () => collectAbilityOptions(allPokemon),
    [allPokemon]
  );

  // The dialog edits a draft, which only reaches the grid when submitted. As
  // the dialog is rendered before it is needed, the draft picks up its
  // starting point at the moment the dialog opens.
  const [draft, setDraft] = useState<PokemonFilters>(
    initialFilters ?? DEFAULT_POKEMON_FILTERS
  );
  const [openedWith, setOpenedWith] = useState(initialFilters);
  if (initialFilters !== openedWith) {
    setOpenedWith(initialFilters);
    if (initialFilters) setDraft(initialFilters);
  }

  const normalizedDraft = useMemo(
    () => normalizePokemonFilters(draft, bounds),
    [draft, bounds]
  );
  const matchCount = useMemo(
    () => filterPokemon(allPokemon, normalizedDraft).length,
    [allPokemon, normalizedDraft]
  );
  const shownCountRef = useRef(matchCount);
  // What the ability filter keeps on its own, shown under its field.
  const abilityPokemonCount = useMemo(
    () =>
      draft.abilities.length === 0
        ? 0
        : filterPokemon(allPokemon, {
            ...DEFAULT_POKEMON_FILTERS,
            abilities: draft.abilities,
          }).length,
    [allPokemon, draft.abilities]
  );
  // The match toggle counts as a change even while too few types are picked
  // for it to filter anything, so "Clear" can always reset what is on screen.
  const isPristine =
    draft.typeMatch === DEFAULT_POKEMON_FILTERS.typeMatch &&
    arePokemonFiltersEqual(normalizedDraft, DEFAULT_POKEMON_FILTERS);
  const matchesEverything = matchCount === allPokemon.length;
  const hasMatches = matchCount > 0;
  const countLabel = hasMatches
    ? `Show ${matchesEverything ? "all " : ""}${matchCount} Pokemon`
    : "No Pokemon found";

  // Screen readers get the count once it settles, not on every slider step.
  const [announcedLabel, setAnnouncedLabel] = useState("");
  useEffect(() => {
    const handle = window.setTimeout(
      () => setAnnouncedLabel(countLabel),
      COUNT_ANNOUNCE_DELAY_MS
    );
    return () => window.clearTimeout(handle);
  }, [countLabel]);

  const { contextSafe } = useGSAP(
    (_context, inContext) => {
      const dialog = dialogRef.current;
      const panel = panelRef.current;
      if (!isOpen || !dialog || !panel || !inContext) return;

      let isCancelled = false;
      let unlockPageScroll: (() => void) | null = null;

      // One microtask later, still before the browser paints: when a dialog
      // is mounted already open, React's StrictMode (in development) runs
      // this effect, undoes it and runs it again, and only the run that stays
      // should pay for opening the dialog.
      queueMicrotask(
        inContext(() => {
          if (isCancelled) return;
          // Locked first: it measures the scrollbar, which is free as long as
          // the dialog has not been laid out yet.
          unlockPageScroll = lockPageScroll();
          dialog.showModal();
          introRef.current = playDialogIntro(
            dialog,
            panel,
            originRef.current,
            () => {
              // Typing a name is the likeliest first move with a keyboard at
              // hand; on touch screens this would only pop the on-screen
              // keyboard open, so focus stays on the dialog there.
              if (hasFinePointer()) {
                searchInputRef.current?.focus({ preventScroll: true });
              }
            }
          );
        })
      );

      return () => {
        isCancelled = true;
        unlockPageScroll?.();
        if (dialog.open) dialog.close();
      };
    },
    { scope: dialogRef, dependencies: [isOpen], revertOnUpdate: true }
  );

  // Roll the number on the button from the count it shows to the new one.
  // Only changes made in the open dialog roll; the starting point it opens
  // with is simply shown.
  const countedForRef = useRef(initialFilters);
  useGSAP(
    () => {
      const node = countRef.current;
      const from = shownCountRef.current;
      const isStartingPoint = countedForRef.current !== initialFilters;
      countedForRef.current = initialFilters;
      countTweenRef.current?.kill();

      if (
        !node ||
        isStartingPoint ||
        from === matchCount ||
        prefersReducedMotion()
      ) {
        shownCountRef.current = matchCount;
        if (node) node.textContent = String(matchCount);
        return;
      }

      const counter = { value: from };
      node.textContent = String(from);
      countTweenRef.current = gsap.to(counter, {
        value: matchCount,
        duration: 0.45,
        ease: "power2.out",
        snap: { value: 1 },
        onUpdate: () => {
          shownCountRef.current = counter.value;
          node.textContent = String(counter.value);
        },
      });
    },
    { dependencies: [matchCount, initialFilters] }
  );

  const requestClose = contextSafe(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel || isClosingRef.current) return;

    isClosingRef.current = true;
    introRef.current?.kill();
    playDialogOutro(dialog, panel, originRef.current, () => dialog.close());
  });

  const playRejected = contextSafe(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      anim("submit"),
      { x: -9 },
      {
        x: 0,
        duration: 0.55,
        ease: "elastic.out(1.4, 0.22)",
        clearProps: "transform",
      }
    );
  });

  const playCleared = contextSafe(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      anim("clear-icon"),
      { rotate: 0 },
      { rotate: -360, duration: 0.7, ease: "power3.out", clearProps: "rotate" }
    );
    // Queried before React re-renders, so these are the tiles being switched off.
    const clearedGems = dialogRef.current?.querySelectorAll(
      '.af-tile[aria-pressed="true"] .af-tile__gem'
    );
    if (clearedGems?.length) {
      gsap.fromTo(
        clearedGems,
        { scale: 0.72 },
        { scale: 1, duration: 0.5, ease: "back.out(2.4)", stagger: 0.035 }
      );
    }
  });

  // Escape, or the Android back gesture. An open popover handles it itself.
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (popoverLayer && popoverLayer.childElementCount > 0) return;
    requestClose();
  };

  const handleNativeClose = () => {
    // When the effect above is re-run (Fast Refresh with the dialog open), the
    // dialog is closed and shown again before that close event is delivered.
    if (dialogRef.current?.open) return;
    originRef.current?.focus({ preventScroll: true });
    onClosed();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasMatches) {
      playRejected();
      return;
    }
    setFilters(normalizedDraft);
    requestClose();
  };

  const handleClear = () => {
    if (isPristine) return;
    playCleared();
    setDraft(DEFAULT_POKEMON_FILTERS);
  };

  const setQuery = (query: string) =>
    setDraft((current) => ({ ...current, query }));

  const toggleType = useCallback(
    (type: PokemonTypeName) =>
      setDraft((current) => ({
        ...current,
        types: toggleItem(current.types, type),
      })),
    []
  );

  const setTypeMatch = useCallback(
    (typeMatch: TypeMatchMode) =>
      setDraft((current) => ({
        ...current,
        typeMatch,
        // "Both" can only ever match two types, so later picks are dropped.
        types:
          typeMatch === "all"
            ? current.types.slice(0, MAX_TYPES_PER_POKEMON)
            : current.types,
      })),
    []
  );

  const toggleRegion = useCallback(
    (region: PokemonRegionId) =>
      setDraft((current) => ({
        ...current,
        regions: toggleItem(current.regions, region),
      })),
    []
  );

  const toggleAbility = useCallback(
    (ability: string) =>
      setDraft((current) => ({
        ...current,
        abilities: toggleItem(current.abilities, ability),
      })),
    []
  );

  const clearAbilities = useCallback(
    () => setDraft((current) => ({ ...current, abilities: [] })),
    []
  );

  const setIdRange = useCallback(
    (idRange: PokemonIdRange) =>
      setDraft((current) => ({ ...current, idRange })),
    []
  );

  return (
    <dialog
      ref={dialogRef}
      className="af-dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleNativeClose}
    >
      <div className="af-backdrop" data-anim="backdrop" onClick={requestClose} />

      <div className="af-panel" ref={panelRef}>
        <div className="af-surface">
          <header className="af-header">
            <div className="af-tab-glow" data-anim="tab">
              <div className="af-tab">
                <SlidersIcon className="af-tab__icon" />
                <h2 className="af-title" id={titleId} aria-label={TITLE}>
                  {Array.from(TITLE, (char, index) => (
                    <span key={index} data-anim="title-char" aria-hidden>
                      {char}
                    </span>
                  ))}
                </h2>
              </div>
            </div>
            <button
              type="button"
              className="af-close"
              data-anim="close"
              aria-label="Close"
              onClick={requestClose}
            >
              <CloseIcon />
            </button>
          </header>

          <form className="af-form" noValidate onSubmit={handleSubmit}>
            <PopoverLayerContext.Provider value={popoverLayer}>
              <div className="af-body">
                <div className="af-search" data-anim="section">
                  <input
                    ref={searchInputRef}
                    className="af-search__input"
                    type="text"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={SEARCH_LABEL}
                    placeholder={searchPlaceholder}
                    value={draft.query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {draft.query !== "" && (
                    <button
                      type="button"
                      className="af-icon-button"
                      aria-label="Clear search text"
                      onClick={() => {
                        setQuery("");
                        searchInputRef.current?.focus();
                      }}
                    >
                      <CloseIcon />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="af-search__submit"
                    aria-label="Search"
                  >
                    <SearchIcon />
                  </button>
                </div>

                <TypeFilter
                  selected={draft.types}
                  matchMode={draft.typeMatch}
                  onToggle={toggleType}
                  onMatchModeChange={setTypeMatch}
                />

                <RegionFilter
                  regions={regions}
                  selected={draft.regions}
                  onToggle={toggleRegion}
                />

                <div className="af-split">
                  <AbilitySelect
                    options={abilityOptions}
                    selected={draft.abilities}
                    pokemonCount={abilityPokemonCount}
                    onToggle={toggleAbility}
                    onClear={clearAbilities}
                  />
                  <DexRangeSlider
                    bounds={bounds}
                    value={draft.idRange ?? bounds}
                    onChange={setIdRange}
                    regions={regions}
                    selectedRegions={draft.regions}
                  />
                </div>
              </div>
            </PopoverLayerContext.Provider>

            <footer className="af-footer" data-anim="footer">
              <button
                type="button"
                className="af-btn af-btn--ghost"
                title="Clear all filters"
                aria-disabled={isPristine || undefined}
                onClick={handleClear}
              >
                <ResetIcon data-anim="clear-icon" />
                <span className="af-btn__label">Clear</span>
              </button>
              <button
                type="submit"
                className="af-btn af-btn--primary"
                data-anim="submit"
                aria-label={countLabel}
                aria-disabled={!hasMatches || undefined}
              >
                {hasMatches ? (
                  <>
                    <SearchIcon />
                    <span className="af-btn__label">
                      Show {matchesEverything ? "all " : ""}
                      <span className="af-btn__count" ref={countRef} /> Pokemon
                    </span>
                  </>
                ) : (
                  "No Pokemon found"
                )}
              </button>
            </footer>
          </form>

          <div className="af-scan" data-anim="scan" aria-hidden />
        </div>

        <div className="af-orbit" data-anim="orbit" aria-hidden>
          <div className="af-orbit__ring">
            <span className="af-orbit__carrier" data-anim="orbit-carrier">
              <span className="af-orbit__streak" />
            </span>
          </div>
          <span className="af-orbit__carrier" data-anim="orbit-carrier">
            <span className="af-orbit__halo" />
          </span>
        </div>

        <svg className="af-frame" data-anim="frame" aria-hidden>
          <rect className="af-frame__trace" data-anim="trace" pathLength={1} />
        </svg>
      </div>

      <div className="af-layer" ref={setPopoverLayer} />
      <p className="sr-only" role="status">
        {announcedLabel}
      </p>
    </dialog>
  );
});
