"use client";

import { useActionState } from "react";
import { Phone, Lock, ChevronRight, ShieldCheck } from "lucide-react";
import { teacherLogin, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function TeacherLoginPage() {
  const [state, formAction, pending] = useActionState(
    teacherLogin,
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
      <div
        style={{
          width: "100%",
          maxWidth: 420,
        }}
      >
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
              Portal Pengajar
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

        <div
          className="card-mpt"
          style={{
            padding: "28px 24px",
          }}
        >
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
            Gunakan nomor WhatsApp dan password yang sudah diberikan admin.
          </p>

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field
              icon={<Phone size={16} strokeWidth={2.2} />}
              label="Nomor WhatsApp"
              name="phone"
              type="tel"
              placeholder="0812xxxx"
              autoComplete="tel"
              required
            />
            <Field
              icon={<Lock size={16} strokeWidth={2.2} />}
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {state.error && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "color-mix(in oklab, var(--danger), transparent 88%)",
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
                cursor: pending ? "not-allowed" : "pointer",
              }}
            >
              {pending ? "Memproses..." : "Masuk"}
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
            Lupa password? Hubungi admin via WhatsApp untuk reset manual.
            <br />
            (Reset mandiri dinonaktifkan demi keamanan akun pengajar.)
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  name: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
}

function Field(props: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          transition: "border 0.15s ease",
        }}
      >
        <div style={{ color: "var(--ink-mute)" }}>{props.icon}</div>
        <input
          name={props.name}
          type={props.type}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          required={props.required}
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
  );
}
