"use client";

import {
  KeyboardEvent,
  UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LazyImage } from "@/shared/components/lazy-image/lazy-image";
import { filterPokemon } from "@/shared/selectors/pokemon-filter.selectors";
import { mapPokemon } from "@/shared/selectors/pokemon.selectors";
import { DEFAULT_PAGE_LIMIT } from "@/shared/utils/pagination";
import {
  usePokemonFilters,
  usePokemonList,
  useSearchInput,
  useSetSearchInput,
  useSetSearchTerm,
} from "@/stores";
import type { Pokemon } from "@/types/pokemon.types";

const SEARCH_DEBOUNCE_MS = 400;
const SCROLL_BOTTOM_THRESHOLD_PX = 60;

const capitalizeWords = (value: string): string =>
  value
    .split(" ")
    .map((char) => char.charAt(0).toUpperCase() + char.substring(1))
    .join(" ");

export function SearchBar() {
  const filters = usePokemonFilters();
  const submittedSearchTerm = filters.query;
  const setSubmittedSearchTerm = useSetSearchTerm();
  const allPokemon = usePokemonList();

  // The typed text lives in the store so the advanced filter dialog can pick
  // up a term that hasn't been submitted yet, and so applying filters there
  // keeps this box in sync.
  const pokemonName = useSearchInput();
  const setPokemonName = useSetSearchInput();
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_PAGE_LIMIT);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter the cached `?all=true` list against the debounced term locally —
  // no API roundtrip. Suggestions preview what submitting would show, so they
  // respect the other active filters too. The dropdown reveals `visibleCount`
  // items at a time and grows as the user scrolls to the bottom of the panel.
  const matchedPokemon: Pokemon[] = useMemo(() => {
    const trimmed = debouncedTerm.trim();
    if (!trimmed) return [];
    return filterPokemon(allPokemon, { ...filters, query: trimmed })
      .map(mapPokemon)
      .filter((item): item is Pokemon => item !== null);
  }, [allPokemon, debouncedTerm, filters]);

  const dropdownItems = useMemo(
    () => matchedPokemon.slice(0, visibleCount),
    [matchedPokemon, visibleCount]
  );
  const hasMore = visibleCount < matchedPokemon.length;

  // Treat "user typed something but the debounce hasn't fired yet" as a still
  // in-flight search so the "No results" copy doesn't flash before filtering.
  const trimmedName = pokemonName.trim();
  const isSearching =
    trimmedName.length > 0 && trimmedName !== debouncedTerm;
  const showNoResults =
    !isSearching && trimmedName.length > 0 && dropdownItems.length === 0;

  const handleInputChange = (value: string) => {
    setPokemonName(value);
    setShowSearchBar(value.length > 0);
  };

  const submitSearch = useCallback(
    (value: string) => {
      const term = value.trim();
      if (term !== submittedSearchTerm) {
        setSubmittedSearchTerm(term);
      }
      setShowSearchBar(false);
    },
    [setSubmittedSearchTerm, submittedSearchTerm]
  );

  const handleSubmitSearch = useCallback(
    () => submitSearch(pokemonName),
    [pokemonName, submitSearch]
  );

  // Picking a suggestion fills the box with that name and searches for it
  // straight away. The name is passed along because the text in the store
  // only updates on the next render.
  const handleSelectSuggestion = (name: string) => {
    setPokemonName(name);
    submitSearch(name);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleSubmitSearch();
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore) return;
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setVisibleCount((count) => count + DEFAULT_PAGE_LIMIT);
    }
  };

  // Debounce the typed name so the local filter only runs after the user
  // stops typing. The main grid is unaffected — it only updates on submit.
  useEffect(() => {
    const trimmed = pokemonName.trim();
    if (!trimmed) {
      setDebouncedTerm("");
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedTerm(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [pokemonName]);

  // Reset the dropdown's page size whenever the active filter changes so a
  // new search always starts from the first batch.
  useEffect(() => {
    setVisibleCount(DEFAULT_PAGE_LIMIT);
  }, [debouncedTerm]);

  // Close the dropdown when clicking outside the search container.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) {
        setShowSearchBar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="searchbar-container relative min-w-0 flex-[0_1_500px]"
    >
      <input
        type="text"
        value={pokemonName}
        placeholder="Search for Pokemon"
        className="w-full max-h-[40px] outline-none p-2.5 text-[21px] capitalize tracking-[0.5px] text-black bg-white max-[450px]:text-[5vw]"
        onClick={() => setShowSearchBar(pokemonName.length > 0)}
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div
        className="absolute right-0 top-1/2 w-[70px] h-[97%] -translate-y-1/2 bg-[#b4ebff] cursor-pointer transition-all duration-300 hover:bg-[#b2ecff]"
        onClick={handleSubmitSearch}
        role="button"
        aria-label="Submit search"
      >
        <img
          src="/images/icon_magnifying_glass.png"
          alt="search-icon"
          className="h-[25px]! w-[25px]! absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
        />
      </div>

      {pokemonName && showSearchBar && (
        <div
          className="pokemon-search-list bg-[#0d1117] w-full absolute z-[1] max-h-[389px] overflow-y-auto"
          onScroll={handleListScroll}
        >
          {isSearching ? (
            <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-3 text-[#c9d1d9] text-sm tracking-[0.5px] bg-[#0d1117] min-h-[120px]">
              <img
                src="/images/loading-img/Spin-1s-200px.gif"
                alt="searching"
                className="w-[40px]! h-[40px]!"
              />
              <span>Searching...</span>
            </div>
          ) : showNoResults ? (
            <div className="flex justify-between items-center px-[30px] cursor-pointer border-[1.2px] border-[#8b949e] border-t-0">
              <div className="py-5">
                <h3 className="m-0">No results</h3>
              </div>
            </div>
          ) : (
            <>
              {dropdownItems.map((value) => {
                const displayName = capitalizeWords(value.name);
                const thumbnail =
                  value.image.detail ||
                  value.image.full ||
                  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${value.id}.png`;

                return (
                  <div
                    className="flex justify-between items-center px-[30px] cursor-pointer border-[1.2px] border-[#8b949e] border-t-0"
                    onClick={() => handleSelectSuggestion(value.name)}
                    key={value.id}
                  >
                    <div className="pokemon-thumbnail w-[100px] h-[100px]">
                      <LazyImage
                        src={thumbnail}
                        alt={displayName}
                      />
                    </div>
                    <div className="py-5">
                      <h3 className="m-0">{displayName}</h3>
                    </div>
                  </div>
                );
              })}

              {!hasMore && dropdownItems.length > 0 && (
                <div className="flex items-center justify-center gap-2.5 px-4 py-3 text-[#8b949e] italic text-sm tracking-[0.5px] border-t border-[#8b949e] bg-[#0d1117]">
                  <span>No more results</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
