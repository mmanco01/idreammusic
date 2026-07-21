import PolyhymniaKnowledgeLibrary from "@/components/studio/PolyhymniaKnowledgeLibrary";

export const metadata = {
  title: "Calliope Knowledge Library | iDreamMusic",
  description:
    "Search, curate, and embed Calliope's narrative and storytelling knowledge.",
};

export default function CalliopeKnowledgeLibraryPage() {
  return (
    <PolyhymniaKnowledgeLibrary
      museSlug="calliope"
      museName="Calliope"
      defaultQuery="How can a song create a compelling character, clear stakes, and an earned narrative turn?"
    />
  );
}
