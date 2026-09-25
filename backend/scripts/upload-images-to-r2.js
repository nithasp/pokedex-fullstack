/**
 * Uploads all local Pokemon images to Cloudflare R2 (S3-compatible).
 *
 * Setup:
 *   Add these to backend/.env:
 *     R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *     R2_ACCESS_KEY_ID=<your-access-key-id>
 *     R2_SECRET_ACCESS_KEY=<your-secret-access-key>
 *     R2_BUCKET=pokedex-images
 *
 * Usage:
 *   node backend/scripts/upload-images-to-r2.js
 *
 * Options:
 *   --dry-run   Print what would be uploaded without actually uploading
 *   --force     Re-upload even if the file already exists in R2
 */

const dns = require("dns");
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

if (process.platform === "win32") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const TOTAL = 898;
const CONCURRENCY = 10;
const IMAGES_DIR = path.resolve(__dirname, "../public/images/pokemon");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

function required(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`\nError: ${key} is not set in backend/.env\n`);
    process.exit(1);
  }
  return v;
}

const ENDPOINT = required("R2_ENDPOINT");
const ACCESS_KEY = required("R2_ACCESS_KEY_ID");
const SECRET_KEY = required("R2_SECRET_ACCESS_KEY");
const BUCKET = required("R2_BUCKET");

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const pad = (id) => String(id).padStart(3, "0");

async function existsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function upload(localPath, r2Key) {
  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
      Body: body,
      ContentType: "image/png",
      // Cache for 1 year — images never change for a given pokemon id
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

async function pool(tasks, concurrency) {
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      await tasks[idx++]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  if (DRY_RUN) console.log("\n[DRY RUN] No files will be uploaded.\n");

  console.log(`Bucket    : ${BUCKET}`);
  console.log(`Endpoint  : ${ENDPOINT}`);
  console.log(`Images dir: ${IMAGES_DIR}\n`);

  const types = ["full", "detail"];
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  const tasks = [];
  for (let id = 1; id <= TOTAL; id++) {
    const file = `${pad(id)}.png`;
    for (const type of types) {
      const localPath = path.join(IMAGES_DIR, type, file);
      const r2Key = `images/pokemon/${type}/${file}`;

      tasks.push(async () => {
        if (!fs.existsSync(localPath)) {
          failed++;
          errors.push({ r2Key, error: "local file not found" });
          return;
        }

        if (!FORCE && !DRY_RUN) {
          const already = await existsInR2(r2Key);
          if (already) {
            skipped++;
            process.stdout.write(`\r[skip] ${r2Key}                            `);
            return;
          }
        }

        if (DRY_RUN) {
          uploaded++;
          process.stdout.write(`\r[dry]  ${r2Key}                             `);
          return;
        }

        try {
          await upload(localPath, r2Key);
          uploaded++;
          process.stdout.write(
            `\r[${uploaded + skipped}/${TOTAL * 2}] Uploaded: ${r2Key}        `
          );
        } catch (err) {
          failed++;
          errors.push({ r2Key, error: err.message });
          process.stdout.write(`\r[FAIL] ${r2Key}: ${err.message}\n`);
        }
      });
    }
  }

  console.log(`Starting upload of ${TOTAL * 2} images (${CONCURRENCY} concurrent)...\n`);
  await pool(tasks, CONCURRENCY);

  console.log("\n\n─── Summary ────────────────────────────────────────");
  console.log(`  Uploaded : ${uploaded}`);
  console.log(`  Skipped  : ${skipped} (already in R2, use --force to re-upload)`);
  console.log(`  Failed   : ${failed}`);
  if (errors.length) {
    console.log("\n  Errors:");
    errors.forEach(({ r2Key, error }) => console.log(`    ${r2Key} → ${error}`));
  }
  console.log("────────────────────────────────────────────────────\n");

  if (uploaded > 0 && !DRY_RUN) {
    console.log("Next step — update MongoDB with your R2 public URL:");
    console.log(
      `  node scripts/update-image-urls.js --base-url https://pub-XXXX.r2.dev\n` +
      `  (or your custom domain if you set one up in R2)\n`
    );
  }
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
