import { POKEMON_REGIONS } from "@/config/pokemon-regions";
import { POKEMON_TYPE_NAMES } from "@/config/pokemon-types";
import { POKEMON_ID_RANGE } from "@/config/routes";
import type {
  AbilityOption,
  PokemonFilters,
  PokemonIdRange,
  PokemonRegion,
} from "@/types/pokemon-filter.types";
import type { RawPokemon } from "@/types/pokemon.types";

type PokemonMatcher = (pokemon: RawPokemon) => boolean;

export const DEFAULT_POKEMON_FILTERS: PokemonFilters = {
  query: "",
  types: [],
  typeMatch: "any",
  regions: [],
  abilities: [],
  idRange: null,
};

/**
 * A pokemon never has more than two types, so an `all` match is only
 * satisfiable with up to this many selected types.
 */
export const MAX_TYPES_PER_POKEMON = 2;

/**
 * Lowercase and drop everything but letters and digits, so `Mr. Mime`,
 * `mr mime` and `mrmime` all match the stored name `mr-mime`.
 */
const normalizeText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** `25`, `025`, `#25` and `No. 25` all mean Pokedex number 25. */
const DEX_NUMBER_PATTERN = /^(?:#|no\.?)?\s*0*(\d+)$/i;

export const parseDexNumber = (query: string): number | null => {
  const match = DEX_NUMBER_PATTERN.exec(query.trim());
  if (!match) return null;
  const dexNumber = Number(match[1]);
  return Number.isSafeInteger(dexNumber) ? dexNumber : null;
};

/** Matches when the query is the pokemon's number, or part of its name. */
const createQueryMatcher = (query: string): PokemonMatcher | null => {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const dexNumber = parseDexNumber(trimmed);
  const needle = normalizeText(trimmed);
  // A symbols-only query (e.g. "-") has nothing left once normalised, so it
  // falls back to a literal match instead of matching every pokemon.
  const literalNeedle = trimmed.toLowerCase();

  return (pokemon) => {
    if (dexNumber !== null && pokemon._id === dexNumber) return true;
    const name = pokemon.name.toLowerCase();
    return needle
      ? normalizeText(name).includes(needle)
      : name.includes(literalNeedle);
  };
};

const createTypeMatcher = (
  types: PokemonFilters["types"],
  mode: PokemonFilters["typeMatch"]
): PokemonMatcher | null => {
  if (types.length === 0) return null;

  return (pokemon) => {
    const ownTypes = (pokemon.types ?? []).map((type) => type.toLowerCase());
    return mode === "all"
      ? types.every((type) => ownTypes.includes(type))
      : types.some((type) => ownTypes.includes(type));
  };
};

const createRegionMatcher = (
  regionIds: PokemonFilters["regions"]
): PokemonMatcher | null => {
  if (regionIds.length === 0) return null;

  const ranges = POKEMON_REGIONS.filter((region) =>
    regionIds.includes(region.id)
  ).map((region) => region.range);

  return (pokemon) =>
    ranges.some(
      (range) => pokemon._id >= range.min && pokemon._id <= range.max
    );
};

const createAbilityMatcher = (
  abilities: PokemonFilters["abilities"]
): PokemonMatcher | null => {
  if (abilities.length === 0) return null;

  const wanted = new Set(abilities);
  return (pokemon) =>
    (pokemon.abilities ?? []).some((ability) => wanted.has(ability));
};

const createIdRangeMatcher = (
  range: PokemonFilters["idRange"]
): PokemonMatcher | null =>
  range
    ? (pokemon) => pokemon._id >= range.min && pokemon._id <= range.max
    : null;

/**
 * Apply every active criterion (AND-ed together) to the cached `?all=true`
 * list. Returns the list itself when nothing is active, so memoised callers
 * keep a stable reference.
 */
export const filterPokemon = (
  list: RawPokemon[],
  filters: PokemonFilters
): RawPokemon[] => {
  // Cheapest checks first, so most pokemon are rejected before the name match.
  const matchers = [
    createIdRangeMatcher(filters.idRange),
    createRegionMatcher(filters.regions),
    createTypeMatcher(filters.types, filters.typeMatch),
    createAbilityMatcher(filters.abilities),
    createQueryMatcher(filters.query),
  ].filter((matcher): matcher is PokemonMatcher => matcher !== null);

  if (matchers.length === 0) return list;
  return list.filter((pokemon) => matchers.every((matches) => matches(pokemon)));
};

/** Number of criteria set in the advanced dialog, not counting the query. */
export const countAdvancedFilters = (filters: PokemonFilters): number =>
  filters.types.length +
  filters.regions.length +
  filters.abilities.length +
  (filters.idRange ? 1 : 0);

export const hasActiveFilters = (filters: PokemonFilters): boolean =>
  filters.query.trim() !== "" || countAdvancedFilters(filters) > 0;

/**
 * Lowest and highest Pokedex number in the loaded list. The range slider and
 * the region chips are bounded by the data instead of a hard-coded total.
 */
export const getDexBounds = (list: RawPokemon[]): PokemonIdRange => {
  if (list.length === 0) return { ...POKEMON_ID_RANGE };

  let min = Infinity;
  let max = -Infinity;
  for (const pokemon of list) {
    if (pokemon._id < min) min = pokemon._id;
    if (pokemon._id > max) max = pokemon._id;
  }
  return { min, max };
};

/** Regions that contain at least one Pokedex number within `bounds`. */
export const getAvailableRegions = (bounds: PokemonIdRange): PokemonRegion[] =>
  POKEMON_REGIONS.filter(
    (region) => region.range.min <= bounds.max && region.range.max >= bounds.min
  );

/** `Lightning-rod` -> `Lightning Rod`. */
export const formatAbilityName = (ability: string): string =>
  ability
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Every distinct ability in the list, alphabetical, with its pokemon count. */
export const collectAbilityOptions = (list: RawPokemon[]): AbilityOption[] => {
  const counts = new Map<string, number>();
  for (const pokemon of list) {
    for (const ability of pokemon.abilities ?? []) {
      counts.set(ability, (counts.get(ability) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([value, count]) => ({
    value,
    label: formatAbilityName(value),
    count,
  })).sort((a, b) => a.label.localeCompare(b.label));
};

/** Case- and punctuation-insensitive search over the ability labels. */
export const searchAbilityOptions = (
  options: AbilityOption[],
  term: string
): AbilityOption[] => {
  const needle = normalizeText(term);
  if (!needle) return options;
  return options.filter((option) => normalizeText(option.label).includes(needle));
};

/**
 * Where `term` matches inside `label`, as a `[start, end)` character range.
 * Uses the same case- and punctuation-insensitive comparison as the search,
 * so `lightningrod` highlights all of `Lightning Rod`.
 */
export const findMatchRange = (
  label: string,
  term: string
): [number, number] | null => {
  const needle = normalizeText(term);
  if (!needle) return null;

  // Position in `label` of every character that survives normalisation.
  const positions: number[] = [];
  let haystack = "";
  for (let index = 0; index < label.length; index++) {
    const char = normalizeText(label[index]);
    if (char) {
      haystack += char;
      positions.push(index);
    }
  }

  const start = haystack.indexOf(needle);
  if (start === -1) return null;
  return [positions[start], positions[start + needle.length - 1] + 1];
};

/** `7` -> `007`, matching how the Pokedex prints its numbers. */
export const formatDexNumber = (id: number): string =>
  String(id).padStart(3, "0");

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Canonical form of a filter set: trimmed query, de-duplicated selections in
 * display order (abilities alphabetically, as the dialog lists them), and an
 * id range clamped to `bounds`. Settings that filter nothing collapse to
 * their defaults: a range spanning the whole Pokedex becomes `null`, and the
 * match mode resets unless several types are picked.
 */
export const normalizePokemonFilters = (
  filters: PokemonFilters,
  bounds: PokemonIdRange
): PokemonFilters => {
  let idRange: PokemonIdRange | null = null;
  if (filters.idRange) {
    const low = clamp(Math.round(filters.idRange.min), bounds.min, bounds.max);
    const high = clamp(Math.round(filters.idRange.max), bounds.min, bounds.max);
    const min = Math.min(low, high);
    const max = Math.max(low, high);
    if (min > bounds.min || max < bounds.max) idRange = { min, max };
  }

  const types = POKEMON_TYPE_NAMES.filter((type) =>
    filters.types.includes(type)
  );

  return {
    query: filters.query.trim(),
    types,
    typeMatch: types.length > 1 ? filters.typeMatch : "any",
    regions: POKEMON_REGIONS.filter((region) =>
      filters.regions.includes(region.id)
    ).map((region) => region.id),
    abilities: Array.from(new Set(filters.abilities.filter(Boolean))).sort(
      (a, b) => formatAbilityName(a).localeCompare(formatAbilityName(b))
    ),
    idRange,
  };
};

const haveSameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((item) => b.includes(item));

export const arePokemonFiltersEqual = (
  a: PokemonFilters,
  b: PokemonFilters
): boolean =>
  a.query === b.query &&
  a.typeMatch === b.typeMatch &&
  a.idRange?.min === b.idRange?.min &&
  a.idRange?.max === b.idRange?.max &&
  haveSameItems(a.types, b.types) &&
  haveSameItems(a.regions, b.regions) &&
  haveSameItems(a.abilities, b.abilities);
