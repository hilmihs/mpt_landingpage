/**
 * Runner migrasi.
 *
 *   pnpm db:migrate          jalankan migrasi yang belum diterapkan
 *   pnpm db:migrate --status tampilkan status tanpa mengubah apa pun
 *
 * Tiap file dijalankan di dalam satu transaksi bersama pencatatannya, jadi
 * migrasi yang gagal di tengah tidak meninggalkan skema separuh jadi — DDL
 * di Postgres bersifat transaksional.
 *
 * File .bak diabaikan (mis. _removed_rls.sql.bak, arsip yang tidak boleh jalan).
 */
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  const statusOnly = process.argv.includes("--status");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    fail("DATABASE_URL belum diset. Salin .env.example ke .env.local dulu.");
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
    // NOTICE dari IF NOT EXISTS bukan masalah; error tetap dilempar seperti biasa.
    onnotice: () => {},
  });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        checksum    TEXT NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) fail(`Tidak ada file .sql di ${MIGRATIONS_DIR}`);

    const applied = new Map(
      (
        await sql<{ filename: string; checksum: string }[]>`
          SELECT filename, checksum FROM schema_migrations
        `
      ).map((r) => [r.filename, r.checksum]),
    );

    let ran = 0;

    for (const filename of files) {
      const content = await readFile(path.join(MIGRATIONS_DIR, filename), "utf8");
      const checksum = createHash("sha256").update(content).digest("hex");
      const previous = applied.get(filename);

      if (previous) {
        if (previous !== checksum) {
          // Mengubah migrasi yang sudah jalan bikin database dev dan produksi
          // diam-diam berbeda. Selalu tambah file baru.
          fail(
            `${filename} sudah pernah dijalankan tapi isinya berubah.\n` +
              `  Buat migrasi baru, jangan sunting yang lama.`,
          );
        }
        console.log(`  ok    ${filename}`);
        continue;
      }

      if (statusOnly) {
        console.log(`  BARU  ${filename}`);
        continue;
      }

      process.stdout.write(`  run   ${filename} ... `);
      await sql.begin(async (tx) => {
        // Simple protocol: satu file boleh berisi banyak statement, termasuk
        // body fungsi $$...$$ yang mengandung titik koma.
        await tx.unsafe(content).simple();
        await tx`
          INSERT INTO schema_migrations (filename, checksum)
          VALUES (${filename}, ${checksum})
        `;
      });
      console.log("selesai");
      ran++;
    }

    if (statusOnly) {
      console.log("\n  (--status: tidak ada yang dijalankan)\n");
    } else {
      console.log(
        ran === 0
          ? "\n  Database sudah paling baru.\n"
          : `\n  ${ran} migrasi diterapkan.\n`,
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\n  Migrasi gagal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
