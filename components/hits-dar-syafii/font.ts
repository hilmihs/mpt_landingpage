import { Plus_Jakarta_Sans } from "next/font/google";

// Huruf tampilan khusus halaman Darsyafii; tidak dimuat di halaman lain.
export const dsSans = Plus_Jakarta_Sans({
  variable: "--font-ds-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});
