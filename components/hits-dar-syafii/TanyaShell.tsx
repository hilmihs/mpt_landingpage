import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import s from "./dar-syafii.module.css";
import t from "./tanya.module.css";
import { dsSans } from "./font";

/** Kerangka halaman tanya-jawab: pita hijau + lembar krem, satu kolom. */
export function TanyaShell({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`${dsSans.variable} ${s.shell}`}>
      <header className={s.stepHead}>
        <div className={`${s.stepHeadInner} ${s.col}`}>
          <Link href="/daftar-hits/dar-syafii" className={t.back}>
            <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
            Pendaftaran HITS Darsyafii
          </Link>
          <div className={s.eyebrow}>{eyebrow}</div>
          <h1 className={s.stepTitle}>{title}</h1>
          {desc && <p className={s.stepDesc}>{desc}</p>}
        </div>
      </header>
      <main className={`${s.sheet} ${s.col}`}>{children}</main>
    </div>
  );
}
