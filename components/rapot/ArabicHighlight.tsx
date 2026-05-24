import { AlFatihahDisplay } from "@/components/shared/AlFatihahDisplay";
import type { ErrorItem, IndikatorKey } from "@/types";

interface Props {
  errorsByCategory: Record<IndikatorKey, ErrorItem[]>;
}

export function ArabicHighlight({ errorsByCategory }: Props) {
  return (
    <AlFatihahDisplay
      showHighlights
      errorsByCategory={errorsByCategory}
      defaultShowLatin
      defaultShowTerjemahan
    />
  );
}
