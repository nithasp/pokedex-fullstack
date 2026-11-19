"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { countAdvancedFilters } from "@/shared/selectors/pokemon-filter.selectors";
import { usePokemonFilters, useSearchInput } from "@/stores";
import type { PokemonFilters } from "@/types/pokemon-filter.types";
import { SlidersIcon } from "./icons";
import "./advanced-filter.css";

type DialogComponent =
  typeof import("./advanced-filter-dialog").AdvancedFilterDialog;

let loadedDialog: DialogComponent | null = null;
let dialogRequest: Promise<DialogComponent> | null = null;

/**
 * The dialog and GSAP (which only the dialog uses) stay out of the home
 * page's first-load bundle; their chunk is fetched as soon as the trigger has
 * mounted.
 *
 * Deliberately not `next/dynamic` / `React.lazy`: a lazy component suspends
 * the first time it renders, even when its chunk is already there, and React
 * then holds the content back for 300 ms.
 */
const loadDialog = (): Promise<DialogComponent> => {
  dialogRequest ??= import("./advanced-filter-dialog").then(
    (module) => {
      loadedDialog = module.AdvancedFilterDialog;
      return loadedDialog;
    },
    (error: unknown) => {
      // Forget the failure, so the next attempt starts a new request.
      dialogRequest = null;
      throw error;
    }
  );
  return dialogRequest;
};

/**
 * "Search in Detail" entry point: the button next to the search bar, and the
 * dialog it opens. The dialog is rendered as soon as its code is there and
 * waits closed, so pressing the button only has to show it.
 */
export function AdvancedFilter() {
  const filters = usePokemonFilters();
  const searchInput = useSearchInput();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [Dialog, setDialog] = useState<DialogComponent | null>(
    () => loadedDialog
  );
  /** What the dialog starts editing from; `null` while it is closed. */
  const [openWith, setOpenWith] = useState<PokemonFilters | null>(null);
  /** Changes after every use, so each opening gets a pristine dialog. */
  const [dialogKey, setDialogKey] = useState(0);

  const advancedCount = countAdvancedFilters(filters);

  /** Resolves to whether the dialog can be rendered. */
  const prepareDialog = useCallback(
    (isAwaited: boolean): Promise<boolean> =>
      loadDialog().then(
        (component) => {
          // Rendering the closed dialog ahead of time can wait for a quiet
          // moment, unless someone has already pressed the button.
          if (isAwaited) setDialog(() => component);
          else startTransition(() => setDialog(() => component));
          return true;
        },
        () => false
      ),
    []
  );

  useEffect(() => {
    void prepareDialog(false);
  }, [prepareDialog]);

  const handleOpen = () => {
    // The dialog starts from what is applied, plus whatever is typed in the
    // home search box and not submitted yet.
    setOpenWith({ ...filters, query: searchInput });
    if (Dialog) return;
    // The click beat the download, or the download failed: the dialog opens
    // as soon as its code arrives, and the button resets if it never does.
    void prepareDialog(true).then((isReady) => {
      if (!isReady) setOpenWith(null);
    });
  };

  const handleClosed = useCallback(() => {
    setOpenWith(null);
    setDialogKey((key) => key + 1);
  }, []);

  return (
    <div className="af-scope af-entry">
      <button
        ref={triggerRef}
        type="button"
        className="af-trigger"
        aria-haspopup="dialog"
        aria-expanded={openWith !== null}
        data-filtered={advancedCount > 0}
        onClick={handleOpen}
      >
        <SlidersIcon className="af-trigger__icon" />
        {/* Phones only show the icon; the text stays for screen readers. */}
        <span className="af-trigger__label">Search in Detail</span>
        {advancedCount > 0 && (
          // Keyed by the count, so the badge pops again whenever it changes.
          <span className="af-trigger__badge" key={advancedCount}>
            {advancedCount}
            <span className="sr-only"> active filters</span>
          </span>
        )}
      </button>

      {Dialog && (
        <Dialog
          key={dialogKey}
          initialFilters={openWith}
          originRef={triggerRef}
          onClosed={handleClosed}
        />
      )}
    </div>
  );
}
