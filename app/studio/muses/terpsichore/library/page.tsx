import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Terpsichore Knowledge Library | iDreamMusic",
  description:
    "Search Terpsichore's curated knowledge of pulse, pocket, groove, movement, dance, participation, stage energy, and release.",
};

export default function Page() {
  return <MuseKnowledgeLibraryPage museSlug="terpsichore" />;
}
