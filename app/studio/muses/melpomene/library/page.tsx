import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Melpomene Knowledge Library | iDreamMusic",
  description:
    "Search Melpomene's curated knowledge of blues, tragedy, lament, grief, emotional truth, dignity, resilience, and earned hope.",
};

export default function Page() {
  return <MuseKnowledgeLibraryPage museSlug="melpomene" />;
}
