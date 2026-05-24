import Link from "next/link";

export function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Muhajir Project Tilawah
        </Link>
        <nav className="text-sm text-muted-foreground">
          <Link href="/assessment/consent" className="hover:underline">
            Mulai Assessment
          </Link>
        </nav>
      </div>
    </header>
  );
}
