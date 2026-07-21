import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Clio Knowledge Library | iDreamMusic",
  description:
    "Search Clio's curated knowledge of memory, history, place, heritage, oral tradition, and legacy.",
};

export default function Page() {
  return (
    <MuseKnowledgeLibraryPage
      museSlug="clio"
    />
  );
}
