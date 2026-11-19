"use client";

import { type CSSProperties, Fragment, useMemo } from "react";
import { POKEMON_REGIONS } from "@/config/pokemon-regions";
import { TYPES_COLOR, getTypeLabel } from "@/config/pokemon-types";
import {
  DEFAULT_POKEMON_FILTERS,
  filterPokemon,
  formatAbilityName,
  hasActiveFilters,
} from "@/shared/selectors/pokemon-filter.selectors";
import {
  usePokemonFilters,
  usePokemonList,
  useSetPokemonFilters,
} from "@/stores";
import type { PokemonFilters } from "@/types/pokemon-filter.types";
import type { PokemonTypeName } from "@/types/pokemon.types";
import { CloseIcon, ResetIcon } from "./icons";
import { TypeIcon } from "./type-icon";
import "./advanced-filter.css";

interface FilterChip {
  key: string;
  /** Which filter this is, shown in front of its values (e.g. "Type"). */
  title: string;
  /** The values as plain text, e.g. "Bug, Dragon". */
  text: string;
  /** For the type filter: its values, drawn with their gems. */
  types?: PokemonTypeName[];
  /** What joins the types: a comma, or a plus when a pokemon needs both. */
  separator?: string;
  /** The filter set without this filter. */
  next: PokemonFilters;
}

/**
 * One chip per kind of filter, titled like the matching section of the
 * dialog, with all of that filter's values joined in it. Its ✕ drops the
 * whole filter; picking single values apart again is what the dialog is for.
 */
const buildChips = (filters: PokemonFilters): FilterChip[] => {
  const chips: FilterChip[] = [];
  const { query, types, typeMatch, regions, abilities, idRange } = filters;

  if (query) {
    chips.push({
      key: `query:${query}`,
      title: "Search",
      text: `“${query}”`,
      next: { ...filters, query: "" },
    });
  }

  if (types.length > 0) {
    const separator = typeMatch === "all" && types.length > 1 ? " + " : ", ";
    chips.push({
      key: `types:${types.join(separator)}`,
      title: "Type",
      text: types.map(getTypeLabel).join(separator),
      types,
      separator,
      // Without types the "both" mode means nothing, so it goes as well.
      next: { ...filters, types: [], typeMatch: "any" },
    });
  }

  const regionNames = POKEMON_REGIONS.filter((region) =>
    regions.includes(region.id)
  ).map((region) => region.name);
  if (regionNames.length > 0) {
    chips.push({
      key: `regions:${regionNames.join("+")}`,
      title: "Region",
      text: regionNames.join(", "),
      next: { ...filters, regions: [] },
    });
  }

  if (abilities.length > 0) {
    chips.push({
      key: `abilities:${abilities.join("+")}`,
      title: "Ability",
      text: abilities.map(formatAbilityName).join(", "),
      next: { ...filters, abilities: [] },
    });
  }

  if (idRange) {
    chips.push({
      key: `range:${idRange.min}-${idRange.max}`,
      title: "Pokedex Number",
      text:
        idRange.min === idRange.max
          ? String(idRange.min)
          : `${idRange.min} – ${idRange.max}`,
      next: { ...filters, idRange: null },
    });
  }

  return chips;
};

/** A chip's pop-in waits its turn, but never longer than this many steps. */
const MAX_STAGGER_STEPS = 6;

/**
 * What the grid is currently filtered by: the number of pokemon left, one
 * removable chip per filter and a way to drop them all. Renders nothing
 * while no filter is applied.
 *
 * Chips are keyed by what they show, so only a chip whose filter was just
 * applied or changed mounts (and plays the CSS pop-in); the others stay still.
 */
export function ActiveFilterBar() {
  const allPokemon = usePokemonList();
  const filters = usePokemonFilters();
  const setFilters = useSetPokemonFilters();
  const resultCount = useMemo(
    () => filterPokemon(allPokemon, filters).length,
    [allPokemon, filters]
  );

  if (!hasActiveFilters(filters)) return null;
  const chips = buildChips(filters);

  return (
    <div className="af-scope">
      <div
        className="af-active"
        role="group"
        aria-label="Active filters"
        data-empty={resultCount === 0}
      >
        <p className="af-active__count" role="status">
          {resultCount > 0 ? (
            <>
              {/* Keyed by the count, so the number pops whenever it changes. */}
              <strong className="af-active__number" key={resultCount}>
                {resultCount}
              </strong>{" "}
              Pokemon found
            </>
          ) : (
            "No Pokemon found"
          )}
        </p>
        <span className="af-active__divider" aria-hidden />

        <div className="af-active__chips">
          {chips.map((chip, index) => {
            const name = `${chip.title}: ${chip.text}`;

            return (
              <button
                key={chip.key}
                type="button"
                className="af-chip"
                aria-label={`Remove filter: ${name}`}
                // A long list is cut short in the chip; this shows all of it.
                title={name}
                style={
                  {
                    "--af-order": Math.min(index, MAX_STAGGER_STEPS),
                  } as CSSProperties
                }
                onClick={() => setFilters(chip.next)}
              >
                <span className="af-chip__label">
                  <span className="af-chip__title">{chip.title}: </span>
                  {chip.types
                    ? chip.types.map((type, position) => (
                        <Fragment key={type}>
                          {position > 0 && chip.separator}
                          <span
                            className="af-chip__gem"
                            style={
                              {
                                "--type-color": TYPES_COLOR[type],
                              } as CSSProperties
                            }
                          >
                            <TypeIcon type={type} />
                          </span>
                          {getTypeLabel(type)}
                        </Fragment>
                      ))
                    : chip.text}
                </span>
                <span className="af-chip__remove" aria-hidden>
                  <CloseIcon />
                </span>
              </button>
            );
          })}
        </div>

        {chips.length > 1 && (
          <button
            type="button"
            className="af-active__clear"
            onClick={() => setFilters(DEFAULT_POKEMON_FILTERS)}
          >
            <ResetIcon />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
