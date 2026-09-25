import { Request, Response } from "express";
import { config } from "../config/env";
import { Pokemon } from "../models/pokemon";
import type { ListPokemonQuery, PokemonIdParams } from "../types/pokemon-routes.type";
import { HttpError, buildPagination, ok } from "../utils/response";

const padDexId = (id: number): string => String(id).padStart(3, "0");

/**
 * Image paths are deliberately not stored in the DB — they're derived from
 * `_id` plus env vars, so switching CDN, file format, or folder structure is
 * an env/code change with no migration.
 */
function buildImageUrls(id: number): { full: string; detail: string } | null {
  const base = config.r2PublicUrl;
  if (!base) return null;
  const ext = config.imageExtension;
  const name = padDexId(id);
  return {
    full: `${base}/images/pokemon/full/${name}.${ext}`,
    detail: `${base}/images/pokemon/detail/${name}.${ext}`,
  };
}

/**
 * `_id` is typed as nullable by Mongoose's `InferSchemaType`, but in practice
 * every persisted document has one — the guard is defensive narrowing only.
 */
function attachImage<T extends { _id?: number | null }>(pokemon: T) {
  const id = pokemon._id;
  return {
    ...pokemon,
    image: typeof id === "number" ? buildImageUrls(id) : null,
  };
}

// Pokemon data is effectively immutable (refreshed only by manual scripts), so
// we cache aggressively at every layer: 1-day fresh window, 7-day
// stale-while-revalidate grace period.
// On a data update, run Cloudflare's "Purge Everything" — otherwise the change
// takes up to 8 days to reach visitors.
const POKEMON_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

// These timestamps are stored by Mongoose's `timestamps: true` but are never
// read by the frontend (see RawPokemon in frontend/src/types/pokemon.types.ts).
// Dropping them shrinks every list item by ~70 bytes before compression.
const LIST_PROJECTION = { createdAt: 0, updatedAt: 0 } as const;

export const getPokemons = async (req: Request, res: Response) => {
  const { page, limit, type, search, all } = req.valid.query as ListPokemonQuery;

  const filter: Record<string, unknown> = {};
  if (type) filter.types = type;
  if (search) filter.name = { $regex: search, $options: "i" };

  const query = Pokemon.find(filter, LIST_PROJECTION).sort({ _id: 1 });
  if (!all) {
    query.skip((page - 1) * limit).limit(limit);
  }

  const items = await query.lean();
  const total = all ? items.length : await Pokemon.countDocuments(filter);

  const effectiveLimit = all ? total : limit;
  res.set("Cache-Control", POKEMON_CACHE_CONTROL);
  return ok(res, items.map(attachImage), buildPagination(page, effectiveLimit, total));
};

export const getPokemon = async (req: Request, res: Response) => {
  const { id } = req.valid.params as PokemonIdParams;

  const pokemon = await Pokemon.findById(id, LIST_PROJECTION).lean();
  if (!pokemon) {
    throw new HttpError(404, `Pokemon #${id} not found`, "POKEMON_NOT_FOUND");
  }

  res.set("Cache-Control", POKEMON_CACHE_CONTROL);
  return ok(res, attachImage(pokemon));
};
