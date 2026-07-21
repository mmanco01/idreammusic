import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Polyhymnia Knowledge Library | iDreamMusic",
  description: "Search, curate, and embed Polyhymnia's faith knowledge.",
};

export default function Page() {
  return (
    <MuseKnowledgeLibraryPage
      museSlug="polyhymnia"
    />
  );
}
