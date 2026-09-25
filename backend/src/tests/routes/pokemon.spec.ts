import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app";
import { Pokemon } from "../../models/pokemon";

const app = buildApp();

const seed = [
  {
    _id: 1,
    name: "bulbasaur",
    types: ["Grass", "Poison"],
    abilities: ["Overgrow"],
  },
  {
    _id: 4,
    name: "charmander",
    types: ["Fire"],
    abilities: ["Blaze"],
  },
  {
    _id: 7,
    name: "squirtle",
    types: ["Water"],
    abilities: ["Torrent"],
  },
  {
    _id: 25,
    name: "pikachu",
    types: ["Electric"],
    abilities: ["Static"],
  },
];

beforeEach(async () => {
  await Pokemon.insertMany(seed);
});

describe("GET /", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "pokedex-backend" });
  });
});

describe("GET /health", () => {
  it("reports the database as reachable", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("connected");
    expect(typeof res.body.latencyMs).toBe("number");
  });

  // The whole point of /health is to reach Mongo on every call. If it ever
  // picks up the shared cache header, an edge cache would answer for it and
  // the Atlas keep-alive ping would silently stop touching the cluster.
  it("is never cached", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET /api/pokemon", () => {
  it("returns paginated list with default page/limit", async () => {
    const res = await request(app).get("/api/pokemon");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 4,
      totalPages: 1,
    });
  });

  it("sorts results by _id ascending", async () => {
    const res = await request(app).get("/api/pokemon");
    const ids = res.body.data.map((p: { _id: number }) => p._id);

    expect(ids).toEqual([1, 4, 7, 25]);
  });

  it("respects pagination", async () => {
    const res = await request(app).get("/api/pokemon?page=2&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]._id).toBe(7);
    expect(res.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
  });

  it("filters by type", async () => {
    const res = await request(app).get("/api/pokemon?type=Fire");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("charmander");
  });

  it("searches by name (case-insensitive)", async () => {
    const res = await request(app).get("/api/pokemon?search=PIKA");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("pikachu");
  });

  it("rejects invalid pagination input", async () => {
    const res = await request(app).get("/api/pokemon?page=0");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows large limit values", async () => {
    const res = await request(app).get("/api/pokemon?limit=999");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination.limit).toBe(999);
  });

  it("returns every matching pokemon when all=true", async () => {
    const res = await request(app).get("/api/pokemon?all=true&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 4,
      total: 4,
      totalPages: 1,
    });
  });

  it("respects pagination when all=false", async () => {
    const res = await request(app).get("/api/pokemon?all=false&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.limit).toBe(2);
  });

  it("rejects invalid all values", async () => {
    const res = await request(app).get("/api/pokemon?all=yes");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/pokemon/:id", () => {
  it("returns a single pokemon by dex number", async () => {
    const res = await request(app).get("/api/pokemon/25");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("pikachu");
    expect(res.body.data._id).toBe(25);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).get("/api/pokemon/9999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("POKEMON_NOT_FOUND");
  });

  it("rejects non-numeric ids with 400", async () => {
    const res = await request(app).get("/api/pokemon/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects negative ids with 400", async () => {
    const res = await request(app).get("/api/pokemon/-1");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Unknown route", () => {
  it("returns a 404 envelope", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
