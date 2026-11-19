import type { RefObject } from "react";
import type {
  AbilityOption,
  PokemonFilters,
  PokemonIdRange,
  PokemonRegion,
  PokemonRegionId,
  TypeMatchMode,
} from "./pokemon-filter.types";
import type { PokemonTypeName } from "./pokemon.types";

export interface AdvancedFilterDialogProps {
  /**
   * What the dialog starts editing from. The dialog is rendered ahead of
   * time and stays closed while this is `null`; passing filters opens it.
   */
  initialFilters: PokemonFilters | null;
  /**
   * Element the dialog grows out of and collapses back into, and that gets
   * keyboard focus back once the dialog has closed.
   */
  originRef: RefObject<HTMLElement | null>;
  /** Called once the close animation has finished. */
  onClosed: () => void;
}

export interface TypeFilterProps {
  /** Selected types, in the order the user picked them. */
  selected: PokemonTypeName[];
  matchMode: TypeMatchMode;
  onToggle: (type: PokemonTypeName) => void;
  onMatchModeChange: (mode: TypeMatchMode) => void;
}

export interface RegionFilterProps {
  regions: PokemonRegion[];
  selected: PokemonRegionId[];
  onToggle: (region: PokemonRegionId) => void;
}

export interface AbilitySelectProps {
  options: AbilityOption[];
  /** Selected abilities (raw values), in the order the user picked them. */
  selected: string[];
  /** How many pokemon have at least one of the selected abilities. */
  pokemonCount: number;
  onToggle: (ability: string) => void;
  onClear: () => void;
}

export interface DexRangeSliderProps {
  /** Lowest and highest selectable Pokedex number. */
  bounds: PokemonIdRange;
  value: PokemonIdRange;
  onChange: (range: PokemonIdRange) => void;
  /** Regions drawn as a scale under the track. */
  regions: PokemonRegion[];
  selectedRegions: PokemonRegionId[];
}
