import type { PokemonFilters } from "./pokemon-filter.types";
import type { RawPokemon } from "./pokemon.types";

export interface PokedexUIState {
  /**
   * Live text of the home search box. Kept in the store rather than in local
   * component state so the advanced filter dialog can pick up a term the user
   * typed but has not submitted yet, and so applying filters from the dialog
   * keeps the box in sync.
   */
  searchInput: string;
  /**
   * Applied filters — drive the main grid. `filters.query` is the submitted
   * search term; the remaining criteria come from the advanced filter dialog.
   */
  filters: PokemonFilters;
  /** Saved scroll position for returning to the home page from a detail page. */
  scrollTopPosition: number;
  /**
   * Global pokemon list, populated once via a single `?all=true` request and
   * reused everywhere (home grid, search dropdown, detail page) so the app
   * never hits the API again for list/detail data.
   */
  pokemonList: RawPokemon[];
  /**
   * Flips to `true` after the bulk list has been fetched successfully. The
   * pages use it to differentiate "still loading the very first time" from
   * "loaded and the list is genuinely empty".
   */
  isPokemonListLoaded: boolean;
  /**
   * How many cards the home grid is currently revealing. Persisted in the
   * store (not local component state) so that returning from the detail page
   * shows the same number of cards the user had loaded — otherwise the saved
   * `scrollTopPosition` would land in empty space.
   */
  homeVisibleCount: number;
}

export interface PokedexUIActions {
  setSearchInput: (value: string) => void;
  /**
   * Apply a new submitted search term, keeping every other active filter.
   * Resets the home grid back to the first page and to the top of the
   * viewport so search results aren't shown mid-scroll under a stale offset.
   */
  setSearchTerm: (term: string) => void;
  /**
   * Replace the whole filter set (advanced filter dialog, active-filter
   * chips). Resets the grid like `setSearchTerm` and mirrors the new query
   * into the search box.
   */
  setFilters: (filters: PokemonFilters) => void;
  setScrollTopPosition: (y: number) => void;
  setPokemonList: (list: RawPokemon[]) => void;
  /** Reveal the next chunk of cards in the home grid. */
  incrementHomeVisibleCount: () => void;
  reset: () => void;
}
