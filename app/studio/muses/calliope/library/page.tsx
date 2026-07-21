import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Calliope Knowledge Library | iDreamMusic",
  description: "Search, curate, and embed Calliope's narrative knowledge.",
};

export default function Page() {
  return (
    <MuseKnowledgeLibraryPage
      museSlug="calliope"
    />
  );
}
