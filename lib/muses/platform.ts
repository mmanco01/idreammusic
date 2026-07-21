import type { MuseSlug } from "@/lib/muses/types";

export type MusePlatformConfig = {
  slug: MuseSlug;
  knowledgeEnabled: boolean;
  libraryEnabled: boolean;
  libraryTitle: string;
  libraryDescription: string;
  defaultKnowledgeQuery: string;
  generalRetrievalCount: number;
  songRetrievalCount: number;
};

export const MUSE_PLATFORM: Record<
  MuseSlug,
  MusePlatformConfig
> = {
  calliope: {
    slug: "calliope",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Calliope Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Calliope's narrative and storytelling knowledge.",
    defaultKnowledgeQuery:
      "How can a song create a compelling character, clear stakes, and an earned narrative turn?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  clio: {
    slug: "clio",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Clio Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Clio's historical, cultural, and roots knowledge.",
    defaultKnowledgeQuery:
      "How can a song use history and cultural memory without becoming a lecture?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  erato: {
    slug: "erato",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Erato Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Erato's love, intimacy, longing, and relationship knowledge.",
    defaultKnowledgeQuery:
      "How can a love song make intimacy specific without becoming sentimental or generic?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  euterpe: {
    slug: "euterpe",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Euterpe Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Euterpe's melody, harmony, craft, and musical-form knowledge.",
    defaultKnowledgeQuery:
      "How can melody, harmony, and form strengthen a song's emotional argument?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  melpomene: {
    slug: "melpomene",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Melpomene Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Melpomene's tragedy, blues, grief, conflict, and catharsis knowledge.",
    defaultKnowledgeQuery:
      "How can a song portray suffering honestly while still creating movement and catharsis?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  polyhymnia: {
    slug: "polyhymnia",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Polyhymnia Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Polyhymnia's faith, prayer, reverence, doubt, and testimony knowledge.",
    defaultKnowledgeQuery:
      "How can a faith song preserve doubt without weakening hope?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  terpsichore: {
    slug: "terpsichore",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Terpsichore Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Terpsichore's rhythm, groove, movement, and performance knowledge.",
    defaultKnowledgeQuery:
      "How can rhythm, groove, and physical movement make this song more compelling?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  thalia: {
    slug: "thalia",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Thalia Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Thalia's humor, wit, play, satire, and comic timing knowledge.",
    defaultKnowledgeQuery:
      "How can humor and surprise deepen a song rather than turning it into a novelty?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
  urania: {
    slug: "urania",
    knowledgeEnabled: true,
    libraryEnabled: true,
    libraryTitle: "Urania Knowledge Library",
    libraryDescription:
      "Search, curate, and embed Urania's wonder, imagination, cosmos, futurism, and possibility knowledge.",
    defaultKnowledgeQuery:
      "How can a song create wonder and scale while remaining emotionally human and concrete?",
    generalRetrievalCount: 7,
    songRetrievalCount: 8,
  },
};

export function getMusePlatformConfig(
  slug: MuseSlug,
): MusePlatformConfig {
  return MUSE_PLATFORM[slug];
}

export function museKnowledgeIsEnabled(
  slug: MuseSlug,
): boolean {
  return MUSE_PLATFORM[slug].knowledgeEnabled;
}
