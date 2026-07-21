import { MuseKnowledgeLibrary } from "@/components/studio/MuseKnowledgeLibrary";
import { getMuseBySlug } from "@/lib/muses";
import { getMusePlatformConfig } from "@/lib/muses/platform";
import type { MuseSlug } from "@/lib/muses/types";

export function MuseKnowledgeLibraryPage({
  museSlug,
}: {
  museSlug: MuseSlug;
}) {
  const muse = getMuseBySlug(museSlug);
  const platform =
    getMusePlatformConfig(museSlug);

  return (
    <main
      className="shell"
      style={{
        paddingTop: "1.5rem",
        paddingBottom: "3rem",
      }}
    >
      <MuseKnowledgeLibrary
        museSlug={muse.slug}
        museName={muse.name}
        defaultQuery={
          platform.defaultKnowledgeQuery
        }
      />
    </main>
  );
}
