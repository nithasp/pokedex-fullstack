"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { filterPokemon } from "@/shared/selectors/pokemon-filter.selectors";
import { mapPokemon } from "@/shared/selectors/pokemon.selectors";
import { prefersReducedMotion } from "@/shared/utils/media-query";
import {
  useHomeVisibleCount,
  useIncrementHomeVisibleCount,
  usePokemonFilters,
  usePokemonList,
} from "@/stores";
import type { Pokemon } from "@/types/pokemon.types";
import { PokemonCardList } from "./pokemon-card";

const DEAL_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(36px) scale(0.96)" },
  { opacity: 1, transform: "none" },
];
const DEAL_DURATION_MS = 550;
const DEAL_STAGGER_MS = 32;

export function PokemonList() {
  const allPokemon = usePokemonList();
  const filters = usePokemonFilters();
  const visibleCount = useHomeVisibleCount();
  const incrementVisibleCount = useIncrementHomeVisibleCount();
  const listRef = useRef<HTMLDivElement>(null);
  const dealtFiltersRef = useRef(filters);

  // Apply the submitted search term and the advanced filters against the
  // cached `?all=true` list. All work is local — no extra API calls, no React
  // Query roundtrips.
  const filteredRaw = useMemo(
    () => filterPokemon(allPokemon, filters),
    [allPokemon, filters]
  );

  // Reveal `visibleCount` items at a time so the "Load More" UX matches the
  // old paginated behaviour without hitting the server.
  const visiblePokemon: Pokemon[] = useMemo(
    () =>
      filteredRaw
        .slice(0, visibleCount)
        .map(mapPokemon)
        .filter((item): item is Pokemon => item !== null),
    [filteredRaw, visibleCount]
  );

  const hasMore = visibleCount < filteredRaw.length;

  // Deal the cards back in whenever a different set of filters is applied.
  // The first render (including coming back from a detail page) and
  // "Load More" leave the cards where they are. A layout effect, so the
  // first keyframe is in place before the new cards are painted.
  useLayoutEffect(() => {
    if (dealtFiltersRef.current === filters) return;
    dealtFiltersRef.current = filters;
    if (prefersReducedMotion()) return;

    listRef.current
      ?.querySelectorAll<HTMLElement>(".pokemon-card")
      .forEach((card, index) => {
        card.animate(DEAL_KEYFRAMES, {
          duration: DEAL_DURATION_MS,
          delay: index * DEAL_STAGGER_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          // Hold the first keyframe while a card waits for its turn.
          fill: "backwards",
        });
      });
  }, [filters]);

  return (
    <div className="wrap-pokemon-list text-center" ref={listRef}>
      <PokemonCardList
        pokemon={visiblePokemon}
        hasMore={hasMore}
        onLoadMore={incrementVisibleCount}
      />
    </div>
  );
}
