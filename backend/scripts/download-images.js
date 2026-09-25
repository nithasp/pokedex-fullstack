/**
 * Downloads all Pokemon images (full + detail) from assets.pokemon.com
 * and saves them to backend/public/images/pokemon/{full,detail}/
 *
 * Usage:  node backend/scripts/download-images.js
 * Run from the project root, or from backend/ — both work.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const TOTAL = 898;
const CONCURRENCY = 10;

const BASE_URLS = {
  full: "https://assets.pokemon.com/assets/cms2/img/pokedex/full",
  detail: "https://assets.pokemon.com/assets/cms2/img/pokedex/detail",
};

const OUT_DIR = path.resolve(__dirname, "../public/images/pokemon");
const DIRS = {
  full: path.join(OUT_DIR, "full"),
  detail: path.join(OUT_DIR, "detail"),
};

const pad = (id) => String(id).padStart(3, "0");

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      resolve("skip");
      return;
    }

    const file = fs.createWriteStream(destPath);

    const req = https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(destPath);
        https.get(res.headers.location, (r2) => {
          if (r2.statusCode !== 200) {
            file.close();
            fs.unlink(destPath, () => {});
            reject(new Error(`HTTP ${r2.statusCode} for ${url}`));
            return;
          }
          const f2 = fs.createWriteStream(destPath);
          r2.pipe(f2);
          f2.on("finish", () => { f2.close(); resolve("ok"); });
          f2.on("error", reject);
        }).on("error", reject);
        return;
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      res.pipe(file);
      file.on("finish", () => { file.close(); resolve("ok"); });
    });

    req.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function pool(tasks, concurrency) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  Object.values(DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

  const types = ["full", "detail"];
  let done = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  const tasks = [];
  for (let id = 1; id <= TOTAL; id++) {
    const file = `${pad(id)}.png`;
    for (const type of types) {
      const url = `${BASE_URLS[type]}/${file}`;
      const dest = path.join(DIRS[type], file);
      tasks.push(async () => {
        try {
          const result = await download(url, dest);
          if (result === "skip") {
            skipped++;
            process.stdout.write(`\rSkipped: ${file} (${type}) — already exists`);
          } else {
            done++;
            process.stdout.write(`\r[${done + skipped}/${TOTAL * 2}] Downloaded: ${type}/${file}        `);
          }
        } catch (err) {
          failed++;
          errors.push({ url, error: err.message });
          process.stdout.write(`\r[FAIL] ${type}/${file}: ${err.message}\n`);
        }
      });
    }
  }

  console.log(`\nStarting download of ${TOTAL * 2} images (${CONCURRENCY} concurrent)...\n`);
  await pool(tasks, CONCURRENCY);

  console.log("\n\n─── Summary ───────────────────────────────────────");
  console.log(`  Downloaded : ${done}`);
  console.log(`  Skipped    : ${skipped} (already existed)`);
  console.log(`  Failed     : ${failed}`);
  if (errors.length) {
    console.log("\n  Failed URLs:");
    errors.forEach(({ url, error }) => console.log(`    ${url}\n      → ${error}`));
  }
  console.log("────────────────────────────────────────────────────\n");
  console.log(`Images saved to:\n  ${DIRS.full}\n  ${DIRS.detail}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
