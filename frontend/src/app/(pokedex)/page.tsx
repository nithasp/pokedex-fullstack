"use client";

import { useEffect } from "react";
import { useGetAllPokemon } from "@/shared/hooks/queries";
import {
  useIsPokemonListLoaded,
  useScrollTopPosition,
} from "@/stores";
import { ActiveFilterBar } from "./_components/advanced-filter/active-filter-bar";
import { AdvancedFilter } from "./_components/advanced-filter/advanced-filter";
import { PokemonList } from "./_components/pokemon-list";
import { SearchBar } from "./_components/search-bar";

export default function HomePage() {
  const isLoaded = useIsPokemonListLoaded();
  const scrollTopPosition = useScrollTopPosition();

  // Kick off (or reuse) the single bulk `?all=true` request. Once it resolves
  // the hook hydrates the global pokedex store; the rest of the app reads
  // from that store and never re-hits the API.
  const { error } = useGetAllPokemon();

  // Surface fetch failures to the route-level error boundary so users see
  // the existing "Something went wrong / Try again" UI.
  if (error && !isLoaded) {
    throw error;
  }

  // Restore the saved scroll position when returning from the detail page.
  // The home grid's `homeVisibleCount` is also persisted in the store, so by
  // the time this runs the previously-revealed cards are already mounted and
  // there is real DOM to scroll to.
  useEffect(() => {
    if (isLoaded) {
      window.scrollTo(0, scrollTopPosition);
    }
  }, [isLoaded, scrollTopPosition]);

  return (
    <section className="home-section">
      <h1 className="pokemon-header-title block py-2.5 text-center font-pocket-monk text-[wheat] text-[60px]">
        Pokedex
      </h1>
      {!isLoaded ? (
        <div className="home-loading relative top-[5vw]">
          <img
            src="/images/loading-img/loading250x250-2.gif"
            alt="loading-img"
            className="block mx-auto"
          />
        </div>
      ) : (
        <div className="pokemon-container max-w-full w-[92vw] mx-auto relative">
          <div className="af-toolbar">
            <SearchBar />
            <AdvancedFilter />
          </div>
          <ActiveFilterBar />
          <PokemonList />
        </div>
      )}
    </section>
  );
}
