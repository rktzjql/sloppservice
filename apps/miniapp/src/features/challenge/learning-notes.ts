import type { Attempt } from "@aimi/contracts";
import notes from "./content/learning-notes-10d.json";

// Presentation-only edits for the reviewed ten-day release. Keep server approval,
// model matching and unknown/new content intact; never change answers or scoring.
export function compactLearningTips(
  version: string,
  reveal: NonNullable<Attempt["reveal"]>,
) {
  const edition = notes.find(
    (note) => note.version === version && note.modelId === reveal.modelId,
  );
  return reveal.tips.map((tip) => {
    const replacement = edition?.tips.find(
      (item) => item.originalTitle === tip.title && item.originalText === tip.text,
    );
    return replacement ? { ...tip, title: replacement.title, text: replacement.text } : tip;
  });
}
