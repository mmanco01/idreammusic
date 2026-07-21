import { MuseKnowledgeLibraryPage } from "@/components/studio/MuseKnowledgeLibraryPage";

export const metadata = {
  title: "Erato Knowledge Library | iDreamMusic",
  description:
    "Search Erato's curated knowledge of love, desire, reciprocity, intimacy, vulnerability, consent, attachment, commitment, and relational song.",
};

export default function Page() {
  return <MuseKnowledgeLibraryPage museSlug="erato" />;
}
