import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
import { Mic, Headphones } from "lucide-react";
import { RecordingReviewList } from "@/components/portal/RecordingReviewList";

export const dynamic = "force-dynamic";

interface RecordingRow {
  id: string;
  audio_path: string;
  audio_duration_sec: number | null;
  status: string;
  assigned_tier: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  peserta_nama: string;
  peserta_gender: string;
  peserta_slug: string | null;
  audio_url: string;
}

async function fetchRecordings(status: string): Promise<RecordingRow[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("hits_recordings")
    .select(
      `id, audio_path, audio_duration_sec, status, assigned_tier, reviewer_notes,
       reviewed_at, created_at,
       submissions:submission_id(nama, jenis_kelamin, rapot_slug)`,
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" });

  const rows = (data ?? []) as unknown as {
    id: string;
    audio_path: string;
    audio_duration_sec: number | null;
    status: string;
    assigned_tier: string | null;
    reviewer_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
    submissions: { nama: string; jenis_kelamin: string; rapot_slug: string } | null;
  }[];

  return Promise.all(
    rows.map(async (r) => {
      const { data: urlData } = await sb.storage
        .from("audio-submissions")
        .createSignedUrl(r.audio_path, 3600);

      return {
        id: r.id,
        audio_path: r.audio_path,
        audio_duration_sec: r.audio_duration_sec,
        status: r.status,
        assigned_tier: r.assigned_tier,
        reviewer_notes: r.reviewer_notes,
        reviewed_at: r.reviewed_at,
        created_at: r.created_at,
        peserta_nama: r.submissions?.nama ?? "—",
        peserta_gender: r.submissions?.jenis_kelamin ?? "—",
        peserta_slug: r.submissions?.rapot_slug ?? null,
        audio_url: urlData?.signedUrl ?? "",
      };
    }),
  );
}

export default async function RecordingsPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const pending = await fetchRecordings("pending");
  const classified = await fetchRecordings("classified");

  return (
    <div style={{ maxWidth: 800 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "color-mix(in oklab, var(--accent), transparent 85%)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Mic size={22} strokeWidth={2.2} />
        </div>
        <div>
          <h1
            className="font-display"
            style={{ fontSize: 24, fontWeight: 800, margin: 0 }}
          >
            Review Rekaman HITS
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              margin: "2px 0 0",
            }}
          >
            Dengarkan rekaman peserta dan tentukan kelas HITS Lanjutan yang
            sesuai.
          </p>
        </div>
      </div>

      {/* Pending section */}
      <div style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Headphones size={16} strokeWidth={2.2} color="var(--warning)" />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            Menunggu Review
          </h2>
          <span
            className="pill"
            style={{
              background: "color-mix(in oklab, var(--warning), transparent 82%)",
              color: "var(--warning)",
              fontSize: 11,
            }}
          >
            {pending.length}
          </span>
        </div>

        {pending.length === 0 ? (
          <div
            className="card-mpt"
            style={{
              padding: "32px 24px",
              textAlign: "center",
              color: "var(--ink-mute)",
              fontSize: 14,
            }}
          >
            Tidak ada rekaman yang perlu direview saat ini.
          </div>
        ) : (
          <RecordingReviewList recordings={pending} />
        )}
      </div>

      {/* Classified section */}
      {classified.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: "0 0 16px",
              color: "var(--ink-soft)",
            }}
          >
            Sudah Direview ({classified.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {classified.map((r) => (
              <div
                key={r.id}
                className="card-mpt"
                style={{ padding: "16px 20px", opacity: 0.8 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {r.peserta_nama}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-mute)",
                        marginTop: 2,
                      }}
                    >
                      {r.peserta_gender === "ikhwan" ? "Ikhwan" : "Akhwat"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      className="pill"
                      style={{
                        fontSize: 11,
                        background:
                          "color-mix(in oklab, var(--success), transparent 82%)",
                        color: "var(--success)",
                      }}
                    >
                      {tierLabel(r.assigned_tier)}
                    </span>
                    {r.reviewer_notes && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ink-mute)",
                          marginTop: 4,
                          maxWidth: 200,
                        }}
                      >
                        {r.reviewer_notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function tierLabel(tier: string | null): string {
  switch (tier) {
    case "lanjutan_awal":
      return "Lanjutan Awal";
    case "lanjutan_menengah":
      return "Lanjutan Menengah";
    case "lanjutan_expert":
      return "Lanjutan Expert";
    default:
      return tier ?? "—";
  }
}
