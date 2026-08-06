import Link from "next/link";
import { ClipboardCheck, Search } from "lucide-react";
import { sql } from "@/lib/db";
import {
  fetchAssessments,
  countByTahap,
  sinceLabel,
  bandColor,
  TAHAP_LABEL,
  TAHAP_COLOR,
  TAHAP_ORDER,
  STALE_DAYS,
  type AssessmentRow,
  type Tahap,
  type AssessmentFilter,
} from "@/lib/admin/assessment-query";

/**
 * Daftar seluruh rekaman beserta pengajarnya dan tahapnya.
 *
 * Bedanya dengan /admin/peserta: halaman itu memotret submissions saja, jadi
 * tidak pernah bisa menjawab siapa yang memegang rekaman dan macet di mana.
 * Halaman ini menyatukan submissions, assignments, dan teacher_evaluations —
 * dan menaruh yang paling butuh tindakan di baris teratas.
 */

export const dynamic = "force-dynamic";

const GENDERS = ["ikhwan", "akhwat"] as const;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

/** Susun URL halaman ini dengan satu parameter diganti; sisanya dipertahankan. */
function hrefWith(
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const merged = { ...current, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/assessment?${s}` : "/admin/assessment";
}

export default async function AssessmentAdminPage({ searchParams }: Props) {
  const sp = await searchParams;

  const rawTahap = one(sp.tahap);
  const rawGender = one(sp.gender);
  const current = {
    tahap: TAHAP_ORDER.includes(rawTahap as Tahap) ? rawTahap : undefined,
    gender: GENDERS.includes(rawGender as (typeof GENDERS)[number])
      ? rawGender
      : undefined,
    pengajar: one(sp.pengajar),
    macet: one(sp.macet) === "1" ? "1" : undefined,
    q: one(sp.q),
  };

  const filter: AssessmentFilter = {
    tahap: current.tahap as Tahap | undefined,
    gender: current.gender as "ikhwan" | "akhwat" | undefined,
    pengajar: current.pengajar,
    macet: current.macet === "1",
    q: current.q,
  };

  // Satu bagian yang gagal tidak boleh mengosongkan seluruh halaman: tanpa
  // daftar pengajar, tabelnya masih berguna.
  const [rows, counts, teachers] = await Promise.all([
    fetchAssessments(filter).catch((err) => {
      console.error("[admin.assessment] daftar gagal:", (err as Error).message);
      return [] as AssessmentRow[];
    }),
    countByTahap().catch(() => ({}) as Record<string, number>),
    fetchTeacherOptions().catch(() => [] as TeacherOption[]),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ maxWidth: 1320 }}>
      <header style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          Alur Penilaian
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Assessment
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 640,
          }}
        >
          Setiap rekaman beserta pengajar yang memegangnya. Yang paling butuh
          tindakan ada di atas; baris merah menandakan peserta sudah menunggu
          lebih dari {STALE_DAYS} hari.
        </p>
        <Link
          href="/admin/assessment/pembanding"
          style={{
            display: "inline-block",
            marginTop: 10,
            fontSize: 12,
            color: "var(--ink-mute)",
          }}
        >
          Pembanding mesin vs pengajar →
        </Link>
      </header>

      {/* Chip tahap — angkanya keseluruhan, tidak ikut tersaring, supaya selalu
          ada jalan kembali dari filter yang menghasilkan nol baris. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Chip
          href={hrefWith(current, { tahap: undefined })}
          label="Semua"
          count={total}
          color="var(--ink-mute)"
          active={!current.tahap}
        />
        {TAHAP_ORDER.map((t) => (
          <Chip
            key={t}
            href={hrefWith(current, { tahap: t })}
            label={TAHAP_LABEL[t]}
            count={counts[t] ?? 0}
            color={TAHAP_COLOR[t]}
            active={current.tahap === t}
          />
        ))}
      </div>

      {/* Saringan lain */}
      <div
        className="card-mpt"
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <FilterGroup label="Gender">
          <Chip
            href={hrefWith(current, { gender: undefined })}
            label="Semua"
            color="var(--ink-mute)"
            active={!current.gender}
          />
          <Chip
            href={hrefWith(current, { gender: "ikhwan" })}
            label="Ikhwan"
            color="var(--accent)"
            active={current.gender === "ikhwan"}
          />
          <Chip
            href={hrefWith(current, { gender: "akhwat" })}
            label="Akhwat"
            color="var(--accent)"
            active={current.gender === "akhwat"}
          />
        </FilterGroup>

        <FilterGroup label="Macet">
          <Chip
            href={hrefWith(current, { macet: current.macet ? undefined : "1" })}
            label={`> ${STALE_DAYS} hari`}
            color="var(--danger)"
            active={current.macet === "1"}
          />
        </FilterGroup>

        {/* Pengajar dan pencarian dalam satu form GET: keduanya cukup dikirim
            sekali, dan halaman tetap server component tanpa state klien. */}
        <form
          method="get"
          action="/admin/assessment"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}
        >
          {current.tahap && <input type="hidden" name="tahap" value={current.tahap} />}
          {current.gender && <input type="hidden" name="gender" value={current.gender} />}
          {current.macet && <input type="hidden" name="macet" value={current.macet} />}

          <select
            name="pengajar"
            defaultValue={current.pengajar ?? ""}
            className="input-mpt"
            style={{ minWidth: 190, height: 36, fontSize: 13, padding: "0 10px" }}
            aria-label="Saring menurut pengajar"
          >
            <option value="">Semua pengajar</option>
            <option value="fallback">Superadmin (fallback)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} · {t.jenis_kelamin === "ikhwan" ? "I" : "A"}
              </option>
            ))}
          </select>

          <div style={{ position: "relative" }}>
            <Search
              size={14}
              strokeWidth={2.2}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-mute)",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              name="q"
              defaultValue={current.q ?? ""}
              placeholder="Nama atau nomor WA"
              className="input-mpt"
              style={{
                height: 36,
                fontSize: 13,
                padding: "0 10px 0 30px",
                minWidth: 200,
              }}
            />
          </div>

          <button type="submit" className="btn-mpt" style={{ minHeight: 36, fontSize: 13 }}>
            Terapkan
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState hasFilter={Object.values(current).some(Boolean)} />
      ) : (
        <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)" }}>
                <Th>Nama</Th>
                <Th>Gender</Th>
                <Th>Pengajar</Th>
                <Th>Tahap</Th>
                <Th>Nilai</Th>
                <Th>Menunggu</Th>
                <Th>Masuk</Th>
                <Th>Mesin</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.submission_id}
                  style={{
                    borderTop: "1px solid var(--line)",
                    // Sorotan macet tetap muncul walau filternya tidak aktif —
                    // justru saat menelusuri semua baris itulah yang tertinggal
                    // paling mudah terlewat.
                    background: r.macet
                      ? "color-mix(in oklab, var(--danger), transparent 94%)"
                      : undefined,
                  }}
                >
                  <Td bold>
                    <Link
                      href={`/admin/assessment/${r.submission_id}`}
                      style={{ color: "var(--ink)", textDecoration: "none" }}
                    >
                      {r.nama}
                    </Link>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400 }}>
                      {r.nomor_wa}
                    </div>
                  </Td>
                  <Td>{r.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}</Td>
                  <Td>
                    <PengajarCell row={r} />
                  </Td>
                  <Td>
                    <Pill color={TAHAP_COLOR[r.tahap]}>{TAHAP_LABEL[r.tahap]}</Pill>
                  </Td>
                  <Td>
                    {r.score_min != null ? (
                      <span style={{ fontWeight: 800, color: bandColor(r.score_min) }}>
                        {r.score_min}/10
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-mute)" }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <span
                      style={
                        r.macet ? { color: "var(--danger)", fontWeight: 700 } : undefined
                      }
                    >
                      {r.tahap === "selesai" ? "—" : sinceLabel(r.menunggu_sec)}
                    </span>
                  </Td>
                  <Td>
                    {r.created_at.toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Asia/Jakarta",
                    })}
                  </Td>
                  {/* Pipeline worker AI, terpisah dari tahap pengajar. */}
                  <Td>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                      {r.ai_status}
                      {r.ai_skor != null ? ` · ${r.ai_skor}/5` : ""}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length >= 200 && (
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10 }}>
          Menampilkan 200 baris teratas. Persempit dengan saringan di atas untuk
          melihat sisanya.
        </p>
      )}
    </div>
  );
}

interface TeacherOption {
  id: string;
  nama: string;
  jenis_kelamin: string;
}

async function fetchTeacherOptions(): Promise<TeacherOption[]> {
  return await sql<TeacherOption[]>`
    SELECT id, nama, jenis_kelamin
    FROM teachers
    WHERE status = ${"active"}
    ORDER BY nama ASC
  `;
}

function PengajarCell({ row }: { row: AssessmentRow }) {
  if (!row.assignment_id) {
    return <span style={{ color: "var(--ink-mute)" }}>belum ditugaskan</span>;
  }
  const nonaktif =
    row.teacher_id != null &&
    row.pengajar_status != null &&
    row.pengajar_status !== "active";

  return (
    <div>
      <div>{row.pengajar_nama ?? "—"}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
        {row.pengajar_fallback && (
          <Pill color="var(--warning)" small>
            fallback
          </Pill>
        )}
        {nonaktif && (
          <Pill color="var(--danger)" small>
            {row.pengajar_status}
          </Pill>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  href,
  label,
  count,
  color,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  color: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
        border: `1px solid ${active ? color : "var(--line)"}`,
        background: active
          ? `color-mix(in oklab, ${color}, transparent 86%)`
          : "transparent",
        color: active ? color : "var(--ink-soft)",
      }}
    >
      {label}
      {count != null && (
        <span style={{ opacity: 0.75, fontWeight: 800 }}>{count}</span>
      )}
    </Link>
  );
}

function Pill({
  children,
  color,
  small = false,
}: {
  children: React.ReactNode;
  color: string;
  small?: boolean;
}) {
  return (
    <span
      style={{
        padding: small ? "2px 6px" : "3px 8px",
        fontSize: small ? 9 : 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        borderRadius: 6,
        whiteSpace: "nowrap",
        background: `color-mix(in oklab, ${color}, transparent 85%)`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="card-mpt" style={{ padding: "48px 28px", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 16px",
          borderRadius: 14,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <ClipboardCheck size={24} strokeWidth={2.2} />
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
        {hasFilter
          ? "Tidak ada rekaman yang cocok dengan saringan ini."
          : "Belum ada rekaman peserta yang masuk."}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  bold = false,
}: {
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: bold ? 600 : 400,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
