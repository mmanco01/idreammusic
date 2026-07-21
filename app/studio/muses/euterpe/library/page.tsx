import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Euterpe Knowledge Library | iDreamMusic",
  description:
    "Search Euterpe's curated knowledge of songwriting craft, melody, prosody, form, repetition, arrangement, memory, and performance.",
};

export default function Page() {
  return (
    <MuseKnowledgeLibraryPage
      museSlug="euterpe"
    />
  );
}
