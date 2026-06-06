"use client";

import Link from "next/link";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  Video,
  AlertTriangle,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import {
  getTierInfo,
  generateDemoSessions,
  type HitsTier,
} from "@/lib/demo-data";

export default function SesiDetailPage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}) {
  const { slug, n } = use(params);
  const sp = useSearchParams();
  const tier = (sp.get("tier") ?? "dasar") as HitsTier;
  const sim = parseInt(sp.get("sim") ?? "3", 10);
  const sessionNum = parseInt(n, 10);

  const info = getTierInfo(tier);
  const sessions = generateDemoSessions(tier, sim);
  const session = sessions.find((s) => s.number === sessionNum);

  if (!session) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        <p>Sesi tidak ditemukan.</p>
      </div>
    );
  }

  const isCompleted = session.status === "completed";
  const isUpcoming = session.status === "upcoming";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
      <Link
        href={`/peserta/${slug}/hits/kelas?tier=${tier}&sim=${sim}`}
        className="btn-mpt btn-mpt-outline"
        style={{
          minHeight: 36,
          fontSize: 12,
          padding: "8px 14px",
          marginBottom: 22,
          display: "inline-flex",
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.4} />
        Kembali ke Kelas
      </Link>

      {/* Session Header */}
      <div className="card-mpt" style={{ padding: "24px 22px", marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {isCompleted ? (
            <CheckCircle2 size={24} strokeWidth={2.2} style={{ color: "var(--success)" }} />
          ) : isUpcoming ? (
            <Clock size={24} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
          ) : (
            <Clock size={24} strokeWidth={2.2} style={{ color: "var(--ink-mute)" }} />
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                Sesi {session.number}
              </h1>
              {session.isExam && (
                <span
                  className="pill"
                  style={{
                    background: "color-mix(in oklab, var(--warning), transparent 80%)",
                    color: "var(--warning)",
                  }}
                >
                  <AlertTriangle size={11} />
                  UJIAN
                </span>
              )}
              {isCompleted && (
                <span
                  className="pill"
                  style={{
                    background: "color-mix(in oklab, var(--success), transparent 85%)",
                    color: "var(--success)",
                  }}
                >
                  Hadir
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
              {session.date} · {session.time}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px",
            background: "var(--bg)",
            borderRadius: 12,
            fontSize: 14,
            color: "var(--ink)",
            fontWeight: 600,
          }}
        >
          {session.title}
        </div>
      </div>

      {/* Exam Banner */}
      {session.isExam && (
        <div
          className="card-mpt"
          style={{
            padding: "18px 20px",
            marginBottom: 22,
            background: "color-mix(in oklab, var(--warning), var(--paper) 88%)",
            borderColor: "color-mix(in oklab, var(--warning), transparent 60%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <AlertTriangle
              size={20}
              strokeWidth={2.2}
              style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                Pertemuan Ini Adalah Ujian Kenaikan Tingkat
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
                Pengajar akan menguji pemahaman dan kemampuan membaca Anda
                berdasarkan materi {info.name}. Pastikan Anda sudah muraja'ah
                seluruh materi sebelumnya.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Materi Section */}
      <div className="card-mpt" style={{ padding: "20px 20px", marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <BookOpen size={16} strokeWidth={2.2} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {session.isExam ? "Cakupan Ujian" : "Materi Sesi Ini"}
          </span>
        </div>

        {session.isExam ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {info.materi.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                <CheckCircle2 size={14} strokeWidth={2.4} style={{ color: "var(--success)", flexShrink: 0 }} />
                {m}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 8px" }}>{session.title}</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Sesi ini akan membahas secara mendalam dengan praktik membaca
              langsung bersama pengajar.
            </p>
          </div>
        )}
      </div>

      {/* Teacher Notes (if completed) */}
      {isCompleted && session.teacherNotes && (
        <div className="card-mpt" style={{ padding: "20px 20px", marginBottom: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <MessageSquare size={16} strokeWidth={2.2} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Catatan Pengajar</span>
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              margin: 0,
              lineHeight: 1.6,
              padding: "12px 16px",
              background: "var(--bg)",
              borderRadius: 12,
              fontStyle: "italic",
            }}
          >
            &ldquo;{session.teacherNotes}&rdquo;
          </p>
        </div>
      )}

      {/* Join Button (if upcoming) */}
      {isUpcoming && session.meetUrl && (
        <a
          href={session.meetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-mpt btn-mpt-accent"
          style={{ width: "100%", justifyContent: "center", minHeight: 48, fontSize: 15 }}
        >
          <Video size={18} />
          Gabung Google Meet
        </a>
      )}
    </div>
  );
}
