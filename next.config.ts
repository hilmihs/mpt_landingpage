import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Cloud Run menjalankan image container, bukan platform yang paham Next.
  // "standalone" menghasilkan server mandiri beserta node_modules seperlunya,
  // sehingga image akhir tidak perlu memuat seluruh dependensi build.
  output: "standalone",
};

export default nextConfig;
