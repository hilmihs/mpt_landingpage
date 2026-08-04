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

declare global {
  // Dev HMR membuat modul dievaluasi ulang berkali-kali. Tanpa cache ini,
  // tiap reload membuka pool baru sampai Postgres kehabisan slot koneksi.
  // eslint-disable-next-line no-var
  var __mptDb: ReturnType<typeof postgres> | undefined;
}

function create() {
  // Dibaca di sini, bukan di tingkat modul: `next build` mengimpor tiap route
  // untuk mengumpulkan data halaman, sedangkan env produksi baru ada saat
  // runtime di Cloud Run. Membaca lebih awal membuat build gagal dengan
  // "Missing DATABASE_URL" padahal aplikasinya sendiri baik-baik saja.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }
  // Cloud Run menyambung ke Cloud SQL lewat unix socket di /cloudsql/<instance>.
  // postgres.js TIDAK bisa mengurai socket dari URL: bentuk "@/db?host=..."
  // ditolak sebagai Invalid URL, dan "@localhost/db?host=..." diam-diam jatuh
  // ke TCP localhost — dua-duanya gagal tanpa pesan yang jelas. Yang bekerja
  // adalah meng-override `host` lewat opsi, jadi socket-nya dipisah ke env
  // sendiri dan URL tetap berbentuk TCP biasa.
  const socketPath = process.env.DATABASE_SOCKET_PATH;

  return postgres(connectionString, {
    ...(socketPath ? { host: socketPath } : {}),
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

function connection(): ReturnType<typeof postgres> {
  if (!globalThis.__mptDb) {
    const db = create();
    // Di produksi Cloud Run tiap instance punya proses sendiri, jadi menyimpan
    // di globalThis aman sekaligus mencegah pool ganda saat HMR dev.
    globalThis.__mptDb = db;
  }
  return globalThis.__mptDb;
}

/**
 * Koneksi malas. Sengaja BUKAN `postgres(...)` langsung di tingkat modul:
 * mengimpor file ini tidak boleh menyentuh env atau membuka soket, supaya
 * `next build` bisa mengimpor route mana pun tanpa database.
 *
 * Proxy-nya di atas fungsi karena postgres.js dipakai dua cara sekaligus —
 * sebagai tagged template (`sql\`SELECT 1\``, lewat jebakan apply) dan sebagai
 * objek bermetode (`sql.json`, `sql.begin`, `sql.unsafe`, lewat jebakan get).
 */
export const sql = new Proxy(function () {} as unknown as ReturnType<typeof postgres>, {
  apply(_target, _thisArg, args: unknown[]) {
    return (connection() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const db = connection() as unknown as Record<string | symbol, unknown>;
    const value = db[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
}) as ReturnType<typeof postgres>;
