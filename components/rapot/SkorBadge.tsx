interface Props {
  skor: number;
  label: string;
}

const COLOR: Record<number, string> = {
  5: "bg-emerald-500 text-white",
  4: "bg-green-500 text-white",
  3: "bg-amber-500 text-white",
  2: "bg-orange-500 text-white",
  1: "bg-red-500 text-white",
};

export function SkorBadge({ skor, label }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div
        className={`flex size-28 items-center justify-center rounded-full text-5xl font-bold shadow-lg ${
          COLOR[skor] ?? "bg-gray-500 text-white"
        }`}
        aria-label={`Skor ${skor} dari 5`}
      >
        {skor}
      </div>
      <p className="text-lg font-medium text-center">{label}</p>
      <p className="text-xs text-muted-foreground">Skor dari 5</p>
    </div>
  );
}
