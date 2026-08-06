import { defineConfig } from "vitest/config";

/**
 * Vitest hanya dipakai untuk logika murni — proyeksi penilaian mesin ke
 * instrumen pengajar. Tidak ada environment jsdom karena tidak ada komponen
 * yang diuji di sini; kalau nanti ada, tambahkan environment per-file lewat
 * komentar `// @vitest-environment jsdom`.
 *
 * Ekstensi .mts dipakai supaya file config ini dimuat sebagai ESM — dengan .ts
 * Vite memuatnya sebagai CommonJS dan memperingatkan setiap kali dijalankan.
 */
export default defineConfig({
  resolve: {
    // Menghormati alias "@/*" di tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
