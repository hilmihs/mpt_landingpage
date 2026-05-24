export function Footer() {
  return (
    <footer className="border-t mt-16">
      <div className="mx-auto max-w-4xl px-4 py-6 text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} Muhajir Project Tilawah. Audio peserta
          disimpan maksimal 7 hari.
        </p>
      </div>
    </footer>
  );
}
