import type { Metadata } from "next";
import { Nunito_Sans, Amiri } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Toaster } from "@/components/ui/sonner";

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const amiri = Amiri({
  variable: "--font-arabic",
  weight: ["400", "700"],
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Muhajir Project Tilawah — Assessment Al-Fatihah",
  description:
    "Rekam bacaan Al-Fatihah Anda — sistem memberi umpan balik awal dari 4 indikator kesalahan umum dalam 30 detik.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${nunito.variable} ${amiri.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
