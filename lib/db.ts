import postgres from "postgres";

/**
 * Koneksi Postgres tunggal untuk seluruh aplikasi.
 *
 * Menggantikan supabaseService(). Tidak ada lagi kredensial yang dikirim ke
 * browser — satu-satunya jalan masuk ke data adalah koneksi ini dari server.
 *
 * Otorisasi TIDAK ditegakkan di database (RLS sudah dibuang, lihat
 * docs/MIGRATION_SUPABASE_TO_GCP.md 4.2). Setiap route handler yang menyentuh
 * data pengajar/admin WAJIB memanggil getCurrentTeacher() / getCurrentAdmin()
 * lebih dulu.
 */

const connectionString = process.env.DATABASE_URL;

declare global {
  // Dev HMR membuat modul dievaluasi ulang berkali-kali. Tanpa cache ini,
  // tiap reload membuka pool baru sampai Postgres kehabisan slot koneksi.
  // eslint-disable-next-line no-var
  var __mptDb: ReturnType<typeof postgres> | undefined;
}

function create() {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }
  return postgres(connectionString, {
    // Cloud Run menjalankan banyak instance; jaga jumlah koneksi per instance
    // tetap kecil supaya tidak menembus batas koneksi Cloud SQL.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    // Cloud SQL lewat private IP tidak memakai TLS di level klien.
    ssl: process.env.DATABASE_SSL === "true" ? "require" : false,

    types: {
      // postgres.js mengembalikan `numeric` sebagai STRING supaya presisi
      // desimal tidak hilang. PostgREST dulu mengirimnya sebagai number, jadi
      // tanpa parser ini kolom seperti weighted_score dan ml_confidence
      // diam-diam berubah jadi string: `ml_confidence * 100` menghasilkan NaN,
      // dan bentuk JSON respons berubah tanpa ada yang gagal lebih dulu.
      //
      // Semua numeric di skema ini berskala kecil (skor 1-10, confidence 0-1,
      // durasi detik), jauh di dalam rentang aman double.
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number | string) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

export const sql = globalThis.__mptDb ?? create();

if (process.env.NODE_ENV !== "production") {
  globalThis.__mptDb = sql;
}
