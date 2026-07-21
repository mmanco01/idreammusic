import { PolyhymniaKnowledgeLibrary } from "@/components/studio/PolyhymniaKnowledgeLibrary";

export const metadata = {
  title:
    "Polyhymnia Knowledge Library | iDreamMusic",
};

export default function PolyhymniaKnowledgeLibraryPage() {
  return (
    <main
      className="shell"
      style={{
        paddingTop: "1.5rem",
        paddingBottom: "3rem",
      }}
    >
      <PolyhymniaKnowledgeLibrary />
    </main>
  );
}
