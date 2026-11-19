"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  memo,
  useId,
  useRef,
  useState,
} from "react";
import { formatDexNumber } from "@/shared/selectors/pokemon-filter.selectors";
import type { DexRangeSliderProps } from "@/types/advanced-filter.types";

type Thumb = "min" | "max";

interface DragState {
  pointerId: number;
  /** `null` while two stacked thumbs wait for the drag direction to pick one. */
  thumb: Thumb | null;
  startX: number;
  /** Distance from the thumb's centre to where it was grabbed. */
  grabOffset: number;
}

interface DexNumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  digits: number;
  isActive: boolean;
  onCommit: (value: number) => void;
}

const KEY_STEP_LARGE = 10;
const KEY_STEP_PAGE = 50;
/** Pointer travel (px) before stacked thumbs commit to a direction. */
const DIRECTION_THRESHOLD = 3;
/** Scale segments narrower than this (% of the track) can't fit a label. */
const MIN_LABELLED_SEGMENT = 4;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Editable end of the range. Shows the zero-padded number at rest and the
 * raw digits while focused; commits on blur or Enter.
 */
function DexNumberField({
  label,
  value,
  min,
  max,
  digits,
  isActive,
  onCommit,
}: DexNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (): number => {
    const parsed = Number.parseInt(draft ?? "", 10);
    const next = Number.isNaN(parsed) ? value : clamp(parsed, min, max);
    if (next !== value) onCommit(next);
    return next;
  };

  return (
    <label className="af-readout__field" data-active={isActive}>
      <span aria-hidden>No.</span>
      <input
        ref={inputRef}
        className="af-readout__input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        style={{ width: `${digits + 1}ch` }}
        value={draft ?? formatDexNumber(value)}
        onFocus={() => {
          setDraft(String(value));
          // Select on the next frame: the click that focused the field would
          // otherwise collapse the selection again on mouseup.
          requestAnimationFrame(() => inputRef.current?.select());
        }}
        onChange={(event) =>
          setDraft(event.target.value.replace(/\D/g, "").slice(0, digits))
        }
        onBlur={() => {
          commit();
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Enter confirms the number; it must not submit the whole form.
          event.preventDefault();
          setDraft(String(commit()));
          requestAnimationFrame(() => inputRef.current?.select());
        }}
      />
    </label>
  );
}

export const DexRangeSlider = memo(function DexRangeSlider({
  bounds,
  value,
  onChange,
  regions,
  selectedRegions,
}: DexRangeSliderProps) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [activeThumb, setActiveThumb] = useState<Thumb | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const span = Math.max(bounds.max - bounds.min, 1);
  const digits = String(bounds.max).length;
  const toPercent = (dexNumber: number): number =>
    ((clamp(dexNumber, bounds.min, bounds.max) - bounds.min) / span) * 100;

  /** Move one end of the range; the two thumbs can meet but never cross. */
  const moveThumb = (thumb: Thumb, target: number) => {
    const next = clamp(Math.round(target), bounds.min, bounds.max);
    const range =
      thumb === "min"
        ? { min: Math.min(next, value.max), max: value.max }
        : { min: value.min, max: Math.max(next, value.min) };
    if (range.min !== value.min || range.max !== value.max) onChange(range);
  };

  const valueAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return bounds.min;
    return bounds.min + clamp((clientX - rect.left) / rect.width, 0, 1) * span;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const pressedThumb = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-thumb]"
    );
    const pointerValue = valueAt(event.clientX);
    let thumb: Thumb | null;
    let grabOffset = 0;

    if (pressedThumb) {
      const rect = pressedThumb.getBoundingClientRect();
      grabOffset = event.clientX - (rect.left + rect.width / 2);
    }

    if (value.min !== value.max) {
      thumb = pressedThumb
        ? (pressedThumb.dataset.thumb as Thumb)
        : Math.abs(pointerValue - value.min) <=
            Math.abs(pointerValue - value.max)
          ? "min"
          : "max";
    } else if (!pressedThumb) {
      thumb = pointerValue < value.min ? "min" : "max";
    } else if (value.min <= bounds.min) {
      thumb = "max";
    } else if (value.max >= bounds.max) {
      thumb = "min";
    } else {
      // The thumbs sit on top of each other mid-track: whichever one the
      // browser hit could be unable to move the way the user drags, so the
      // drag direction picks the thumb instead (see handlePointerMove).
      thumb = null;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      thumb,
      startX: event.clientX,
      grabOffset,
    };
    setActiveThumb(thumb);

    if (thumb) {
      // A press on the bare track glides the nearest thumb over to it.
      if (!pressedThumb) moveThumb(thumb, pointerValue);
      trackRef.current
        ?.querySelector<HTMLElement>(`[data-thumb="${thumb}"]`)
        ?.focus({ preventScroll: true });
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.thumb) {
      const travel = event.clientX - drag.startX;
      if (Math.abs(travel) < DIRECTION_THRESHOLD) return;
      drag.thumb = travel < 0 ? "min" : "max";
      setActiveThumb(drag.thumb);
    }
    // From the first real movement on, the thumb tracks the pointer 1:1
    // (the CSS glide is switched off while `data-dragging` is set).
    setIsDragging(true);
    moveThumb(drag.thumb, valueAt(event.clientX - drag.grabOffset));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    setActiveThumb(null);
  };

  const handleThumbKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    thumb: Thumb
  ) => {
    const current = value[thumb];
    const step = event.shiftKey ? KEY_STEP_LARGE : 1;
    let next: number;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = current - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = current + step;
        break;
      case "PageDown":
        next = current - KEY_STEP_PAGE;
        break;
      case "PageUp":
        next = current + KEY_STEP_PAGE;
        break;
      case "Home":
        next = bounds.min;
        break;
      case "End":
        next = bounds.max;
        break;
      default:
        return;
    }

    event.preventDefault();
    moveThumb(thumb, next);
  };

  const renderThumb = (thumb: Thumb) => (
    <div
      className="af-range__thumb"
      data-thumb={thumb}
      data-anim="range-thumb"
      data-active={activeThumb === thumb}
      role="slider"
      tabIndex={0}
      aria-label={
        thumb === "min" ? "Lowest Pokedex number" : "Highest Pokedex number"
      }
      aria-orientation="horizontal"
      aria-valuemin={thumb === "min" ? bounds.min : value.min}
      aria-valuemax={thumb === "min" ? value.max : bounds.max}
      aria-valuenow={value[thumb]}
      aria-valuetext={`No. ${value[thumb]}`}
      style={{ left: `${toPercent(value[thumb])}%` }}
      onKeyDown={(event) => handleThumbKeyDown(event, thumb)}
    >
      <span className="af-range__knob" />
    </div>
  );

  return (
    <section
      className="af-section"
      data-anim="section"
      role="group"
      aria-labelledby={labelId}
    >
      <div className="af-label-row">
        <h3 className="af-label" id={labelId}>
          Pokedex Number
        </h3>
        <span className="af-rule" aria-hidden />
      </div>

      <div className="af-readout">
        <DexNumberField
          label="Lowest Pokedex number"
          value={value.min}
          min={bounds.min}
          max={value.max}
          digits={digits}
          isActive={activeThumb === "min"}
          onCommit={(next) => moveThumb("min", next)}
        />
        <span className="af-readout__dash" aria-hidden />
        <DexNumberField
          label="Highest Pokedex number"
          value={value.max}
          min={value.min}
          max={bounds.max}
          digits={digits}
          isActive={activeThumb === "max"}
          onCommit={(next) => moveThumb("max", next)}
        />
      </div>

      <div
        className="af-range"
        data-dragging={isDragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      >
        <div className="af-range__track" ref={trackRef}>
          <div
            className="af-range__fill"
            data-anim="range-fill"
            style={{
              left: `${toPercent(value.min)}%`,
              right: `${100 - toPercent(value.max)}%`,
            }}
          />
          {renderThumb("min")}
          {renderThumb("max")}
        </div>
      </div>

      <div className="af-scale" aria-hidden>
        {regions.map((region, index) => {
          const left = toPercent(region.range.min);
          const nextRegion = regions[index + 1];
          const width =
            (nextRegion ? toPercent(nextRegion.range.min) : 100) - left;
          const isInRange =
            region.range.min <= value.max && region.range.max >= value.min;

          return (
            <span
              key={region.id}
              className="af-scale__segment"
              data-in-range={isInRange}
              data-selected={selectedRegions.includes(region.id)}
              title={region.name}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {width >= MIN_LABELLED_SEGMENT ? region.generation : null}
            </span>
          );
        })}
      </div>
    </section>
  );
});
