import type { PokemonTypeName } from "./pokemon.types";

export type PokemonRegionId =
  | "kanto"
  | "johto"
  | "hoenn"
  | "sinnoh"
  | "unova"
  | "kalos"
  | "alola"
  | "galar"
  | "hisui"
  | "paldea";

/** Inclusive range of National Pokedex numbers (`_id` on the API documents). */
export interface PokemonIdRange {
  min: number;
  max: number;
}

export interface PokemonRegion {
  id: PokemonRegionId;
  name: string;
  /** Generation that introduced the region's pokemon, as a Roman numeral. */
  generation: string;
  range: PokemonIdRange;
}

/**
 * How several selected types combine. A pokemon has one or two types, so
 * `any` keeps pokemon with at least one of the selected types, while `all`
 * keeps only those that have every selected type (a dual-type search).
 */
export type TypeMatchMode = "any" | "all";

/**
 * Every criterion that narrows the home grid. Criteria are AND-ed together;
 * an empty / `null` criterion means "don't filter on this".
 */
export interface PokemonFilters {
  /** Name fragment or Pokedex number (`pika`, `25`, `#025`, `No. 25`). */
  query: string;
  types: PokemonTypeName[];
  typeMatch: TypeMatchMode;
  /** Matches pokemon from any of the selected regions. */
  regions: PokemonRegionId[];
  /**
   * Matches pokemon that have at least one of the selected abilities, each
   * exactly as stored on the document (e.g. `Lightning-rod`).
   */
  abilities: string[];
  /** `null` means the whole Pokedex. */
  idRange: PokemonIdRange | null;
}

export interface AbilityOption {
  /** Raw value as stored on the pokemon documents. */
  value: string;
  /** Human-friendly label, e.g. `Lightning Rod`. */
  label: string;
  /** How many pokemon have this ability. */
  count: number;
}
