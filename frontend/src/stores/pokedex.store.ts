import { create } from "zustand";
import {
  DEFAULT_POKEMON_FILTERS,
  arePokemonFiltersEqual,
} from "@/shared/selectors/pokemon-filter.selectors";
import { DEFAULT_PAGE_LIMIT } from "@/shared/utils/pagination";
import type {
  PokedexUIActions,
  PokedexUIState,
} from "@/types/pokedex.store.types";
import type { PokemonFilters } from "@/types/pokemon-filter.types";
import type { RawPokemon } from "@/types/pokemon.types";

const INITIAL_STATE: PokedexUIState = {
  searchInput: "",
  filters: DEFAULT_POKEMON_FILTERS,
  scrollTopPosition: 0,
  pokemonList: [],
  isPokemonListLoaded: false,
  homeVisibleCount: DEFAULT_PAGE_LIMIT,
};

export const usePokedexStore = create<PokedexUIState & PokedexUIActions>(
  (set) => ({
    ...INITIAL_STATE,

    setSearchInput: (value: string) => set({ searchInput: value }),
    setSearchTerm: (term: string) =>
      set((state) =>
        state.filters.query === term
          ? state
          : {
              filters: { ...state.filters, query: term },
              homeVisibleCount: DEFAULT_PAGE_LIMIT,
              scrollTopPosition: 0,
            }
      ),
    setFilters: (filters: PokemonFilters) =>
      set((state) => {
        const searchInput = filters.query;
        if (arePokemonFiltersEqual(state.filters, filters)) {
          return state.searchInput === searchInput ? state : { searchInput };
        }
        return {
          filters,
          searchInput,
          homeVisibleCount: DEFAULT_PAGE_LIMIT,
          scrollTopPosition: 0,
        };
      }),
    setScrollTopPosition: (y: number) => set({ scrollTopPosition: y }),
    setPokemonList: (list: RawPokemon[]) =>
      set({ pokemonList: list, isPokemonListLoaded: true }),
    incrementHomeVisibleCount: () =>
      set((state) => ({
        homeVisibleCount: state.homeVisibleCount + DEFAULT_PAGE_LIMIT,
      })),
    reset: () => set({ ...INITIAL_STATE }),
  })
);

export const useSearchInput = () =>
  usePokedexStore((state) => state.searchInput);

export const useSetSearchInput = () =>
  usePokedexStore((state) => state.setSearchInput);

export const useSetSearchTerm = () =>
  usePokedexStore((state) => state.setSearchTerm);

export const usePokemonFilters = () =>
  usePokedexStore((state) => state.filters);

export const useSetPokemonFilters = () =>
  usePokedexStore((state) => state.setFilters);

export const useScrollTopPosition = () =>
  usePokedexStore((state) => state.scrollTopPosition);

export const useSetScrollTopPosition = () =>
  usePokedexStore((state) => state.setScrollTopPosition);

export const usePokemonList = () =>
  usePokedexStore((state) => state.pokemonList);

export const useSetPokemonList = () =>
  usePokedexStore((state) => state.setPokemonList);

export const useIsPokemonListLoaded = () =>
  usePokedexStore((state) => state.isPokemonListLoaded);

export const useHomeVisibleCount = () =>
  usePokedexStore((state) => state.homeVisibleCount);

export const useIncrementHomeVisibleCount = () =>
  usePokedexStore((state) => state.incrementHomeVisibleCount);
