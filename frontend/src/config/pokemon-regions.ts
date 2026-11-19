import type { PokemonRegion } from "@/types/pokemon-filter.types";

/**
 * The API has no region field: a pokemon's home region is implied by its
 * National Pokedex number, so a region is simply an inclusive `_id` range.
 *
 * Every region is listed, but the filter UI only offers the ones the loaded
 * data actually reaches (see `getAvailableRegions`), so Hisui and Paldea stay
 * hidden until the dataset grows past #898.
 */
export const POKEMON_REGIONS: readonly PokemonRegion[] = [
  { id: "kanto", name: "Kanto", generation: "I", range: { min: 1, max: 151 } },
  { id: "johto", name: "Johto", generation: "II", range: { min: 152, max: 251 } },
  { id: "hoenn", name: "Hoenn", generation: "III", range: { min: 252, max: 386 } },
  { id: "sinnoh", name: "Sinnoh", generation: "IV", range: { min: 387, max: 493 } },
  { id: "unova", name: "Unova", generation: "V", range: { min: 494, max: 649 } },
  { id: "kalos", name: "Kalos", generation: "VI", range: { min: 650, max: 721 } },
  { id: "alola", name: "Alola", generation: "VII", range: { min: 722, max: 809 } },
  { id: "galar", name: "Galar", generation: "VIII", range: { min: 810, max: 898 } },
  { id: "hisui", name: "Hisui", generation: "VIII", range: { min: 899, max: 905 } },
  { id: "paldea", name: "Paldea", generation: "IX", range: { min: 906, max: 1025 } },
];
