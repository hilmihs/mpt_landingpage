import Link from "next/link";

/** Tab di kepala halaman admin HITS Darsyafii: pendaftar ↔ pertanyaan. */
export function HitsTabs({
  aktif,
  belumDijawab,
}: {
  aktif: "pendaftar" | "pertanyaan";
  belumDijawab: number;
}) {
  const tabs = [
    { id: "pendaftar", href: "/admin/hits-dar-syafii", label: "Pendaftar" },
    { id: "pertanyaan", href: "/admin/hits-dar-syafii/pertanyaan", label: "Pertanyaan" },
  ] as const;
  return (
    <nav style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--line)" }}>
      {tabs.map((t) => {
        const on = t.id === aktif;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={on ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              marginBottom: -1,
              fontSize: 13,
              fontWeight: on ? 800 : 600,
              color: on ? "var(--accent-deep)" : "var(--ink-soft)",
              borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
              textDecoration: "none",
            }}
          >
            {t.label}
            {t.id === "pertanyaan" && belumDijawab > 0 && <Badge n={belumDijawab} />}
          </Link>
        );
      })}
    </nav>
  );
}

export function Badge({ n }: { n: number }) {
  return (
    <span
      aria-label={`${n} belum dijawab`}
      style={{
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 999,
        background: "var(--danger)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
