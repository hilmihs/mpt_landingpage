# Scripts

Maintenance / setup scripts for Muhajir Project Tilawah.

## `seed-dev.ts` — Development seed (recommended)

Creates 1 dummy admin + 4 dummy pengajar (2 ikhwan, 2 akhwat) with availability
windows, ready for end-to-end V2 funnel testing.

**Run:**

```bash
# Idempotent — safe to re-run
pnpm seed:dev

# Wipe existing dummies first, then re-seed clean
pnpm seed:reset
```

**Prerequisites:**

1. `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
2. Migration `supabase/migrations/0002_booking_v2.sql` applied at the target project
3. **Supabase Auth Phone provider enabled** at Dashboard → Authentication → Providers
   (otherwise pengajar seeding fails — admin works without it via email magic link)

**What gets created:**

| Role | Identity | Login |
|---|---|---|
| Admin | `hilmisobandi@gmail.com` | `/admin/login` → magic link |
| Pengajar 1 | Ustadz Ahmad Hidayat (ikhwan) | `081200000001` / `MPTtest2026!` |
| Pengajar 2 | Ustadz Yusuf Mahmud (ikhwan) | `081200000002` / `MPTtest2026!` |
| Pengajar 3 | Ustadzah Aisyah Rahmawati (akhwat) | `081200000003` / `MPTtest2026!` |
| Pengajar 4 | Ustadzah Fatimah Az-Zahra (akhwat) | `081200000004` / `MPTtest2026!` |

Each pengajar gets 2-3 weekly availability windows (mix of `assessment` & `tahsin`).

**Edit dummies:** open `seed-dev.ts` and tweak the `TEACHERS` array + `ADMIN_EMAIL`
constant at the top.

## `seed-dev.sql` — SQL fallback

Use **only** when you can't run the TS script (e.g., locked-down production
Supabase). Limitation: SQL cannot create `auth.users` — you must create the
auth users via Dashboard first, then replace placeholder UUIDs in the file
before running it in SQL Editor.

## Production seed?

There isn't one. Production should be onboarded through the admin UI:

1. Apply migration `0002_booking_v2.sql`
2. Insert your real admin row via SQL Editor (one-time)
3. Admin logs in to `/admin/login` → invites pengajar from `/admin/pengajar`

The dev seed is **explicitly for testing only** — dummy credentials are weak
and should never reach a real production environment.
