"use client";

import { useActionState } from "react";
import { Mail, ChevronRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { sendMagicLink, type MagicLinkState } from "./actions";

const initialState: MagicLinkState = {};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--primary)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ShieldCheck size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
              }}
            >
              Admin Console
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Muhajir Project Tilawah
            </div>
          </div>
        </div>

        <div className="card-mpt" style={{ padding: "28px 24px" }}>
          {state.sent ? (
            <SentNotice />
          ) : (
            <>
              <h1
                className="font-display"
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  margin: "0 0 6px",
                  letterSpacing: "-0.025em",
                }}
              >
                Masuk
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  margin: "0 0 22px",
                  lineHeight: 1.5,
                }}
              >
                Masukkan email Anda. Kami akan kirim link login yang berlaku 1
                jam.
              </p>

              <form
                action={formAction}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--ink-mute)",
                    }}
                  >
                    Email
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                    }}
                  >
                    <Mail
                      size={16}
                      strokeWidth={2.2}
                      color="var(--ink-mute)"
                    />
                    <input
                      name="email"
                      type="email"
                      placeholder="admin@example.com"
                      autoComplete="email"
                      required
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: 14,
                        color: "var(--ink)",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </label>

                {state.error && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background:
                        "color-mix(in oklab, var(--danger), transparent 88%)",
                      color: "var(--danger)",
                      fontSize: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    {state.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="btn-mpt btn-mpt-accent"
                  style={{
                    minHeight: 50,
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 6,
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  {pending ? "Mengirim..." : "Kirim Link Login"}
                  <ChevronRight size={16} strokeWidth={2.4} />
                </button>
              </form>

              <div
                style={{
                  marginTop: 18,
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                Hanya email yang terdaftar sebagai admin yang akan menerima link.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SentNotice() {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 16px",
          borderRadius: 14,
          background: "var(--success)",
          color: "white",
          display: "grid",
          placeItems: "center",
        }}
      >
        <CheckCircle2 size={28} strokeWidth={2.4} />
      </div>
      <h2
        className="font-display"
        style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}
      >
        Cek inbox Anda
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Kalau email Anda terdaftar sebagai admin, kami sudah mengirimkan link
        login. Periksa juga folder spam.
      </p>
    </div>
  );
}
