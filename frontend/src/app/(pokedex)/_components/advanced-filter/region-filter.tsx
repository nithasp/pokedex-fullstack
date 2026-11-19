"use client";

import { memo, useId } from "react";
import { formatDexNumber } from "@/shared/selectors/pokemon-filter.selectors";
import type { RegionFilterProps } from "@/types/advanced-filter.types";

export const RegionFilter = memo(function RegionFilter({
  regions,
  selected,
  onToggle,
}: RegionFilterProps) {
  const labelId = useId();

  return (
    <section className="af-section" data-anim="section">
      <div className="af-label-row">
        <h3 className="af-label" id={labelId}>
          Region
        </h3>
        <span className="af-rule" aria-hidden />
      </div>

      <div className="af-regions" role="group" aria-labelledby={labelId}>
        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            className="af-region"
            data-anim="region"
            aria-pressed={selected.includes(region.id)}
            onClick={() => onToggle(region.id)}
          >
            <span className="af-region__name">{region.name}</span>
            <span className="af-region__meta">
              <span className="af-region__generation">
                Gen {region.generation} ·{" "}
              </span>
              {formatDexNumber(region.range.min)}–
              {formatDexNumber(region.range.max)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
});
