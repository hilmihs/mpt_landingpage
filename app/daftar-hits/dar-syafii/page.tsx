import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { DaftarDarSyafii } from "@/components/hits-dar-syafii/DaftarDarSyafii";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";

// Huruf tampilan khusus halaman ini; tidak dimuat di halaman lain.
const display = Instrument_Serif({
  variable: "--font-ds-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `Daftar ${DAR_SYAFII.nama} — Muhajir Project Tilawah`,
  description:
    "Kelas HITS untuk orang tua dan wali murid Darsyafii: perbaikan bacaan dan pendalaman huruf-huruf Al-Qur'an, offline di Darsyafii Islamic School, bebas biaya. Daftar dan rekam ujian masuk langsung dari HP.",
};

export default function DaftarDarSyafiiPage() {
  return (
    <div className={display.variable}>
      <DaftarDarSyafii />
    </div>
  );
}
