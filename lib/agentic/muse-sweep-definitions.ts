export type MuseSweepTarget = {
  museKey: string;
  displayName: string;
  candidateVersion: string;
  mission: string;
  targetCapabilities: string[];
};

export type MuseSweepDefinition = {
  sweepKey: string;
  sweepVersion: number;
  depth: number;
  displayName: string;
  baselineVersion: string;
  requestedSourceCount: number;
  targets: MuseSweepTarget[];
};

type MuseProfile = {
  museKey: string;
  displayName: string;
  mission: string;
  targetCapabilities: string[];
};

const MUSE_PROFILES: Record<
  string,
  MuseProfile
> = {
  calliope: {
    museKey: "calliope",
    displayName: "Calliope",
    mission:
      "Strengthen Calliope's ability to help songwriters develop narrative perspective, character, scene, dramatic tension, and story-song structure without over-explaining the story.",
    targetCapabilities: [
      "narrative perspective",
      "character",
      "scene",
      "dramatic tension",
      "story-song structure",
    ],
  },

  clio: {
    museKey: "clio",
    displayName: "Clio",
    mission:
      "Strengthen Clio's ability to help songwriters work with roots, lineage, place, history, tradition, cultural memory, and historical context without turning songs into lectures.",
    targetCapabilities: [
      "historical context",
      "place and cultural memory",
      "lineage and tradition",
      "chronology and time",
      "roots-based songwriting",
    ],
  },

  erato: {
    museKey: "erato",
    displayName: "Erato",
    mission:
      "Strengthen Erato's ability to guide songs about intimacy, desire, vulnerability, attachment, relational tension, and emotionally specific romantic perspective.",
    targetCapabilities: [
      "intimacy and desire",
      "vulnerability",
      "relationship dynamics",
      "romantic point of view",
      "emotional specificity",
    ],
  },

  euterpe: {
    museKey: "euterpe",
    displayName: "Euterpe",
    mission:
      "Strengthen Euterpe's musical-craft guidance around melody, prosody, phrasing, harmony, hooks, song form, and the relationship between lyric and musical motion.",
    targetCapabilities: [
      "melody",
      "prosody and phrasing",
      "harmony",
      "hooks",
      "song form",
    ],
  },

  melpomene: {
    museKey: "melpomene",
    displayName: "Melpomene",
    mission:
      "Strengthen Melpomene's guidance for grief, lament, blues, suffering, catharsis, emotional restraint, tragic perspective, and earned emotional release.",
    targetCapabilities: [
      "grief and lament",
      "blues expression",
      "catharsis",
      "tragic perspective",
      "emotional restraint",
    ],
  },

  polyhymnia: {
    museKey: "polyhymnia",
    displayName: "Polyhymnia",
    mission:
      "Strengthen Polyhymnia's guidance for sacred song, devotion, prayer, hymnody, reverence, spiritual metaphor, communal singing, and language that serves faith without becoming generic.",
    targetCapabilities: [
      "sacred lyric",
      "devotion and prayer",
      "hymnody",
      "spiritual metaphor",
      "reverence and communal song",
    ],
  },

  terpsichore: {
    museKey: "terpsichore",
    displayName: "Terpsichore",
    mission:
      "Strengthen Terpsichore's rhythmic guidance around groove, meter, syncopation, repetition, feel, movement, rhythmic tension, and lyric-rhythm relationships.",
    targetCapabilities: [
      "groove",
      "meter",
      "syncopation",
      "repetition and feel",
      "lyric-rhythm relationship",
    ],
  },

  thalia: {
    museKey: "thalia",
    displayName: "Thalia",
    mission:
      "Strengthen Thalia's guidance for humor, irony, satire, comic timing, wordplay, incongruity, playful perspective, and balancing wit with emotional truth.",
    targetCapabilities: [
      "humor",
      "irony and satire",
      "comic timing",
      "wordplay",
      "playful point of view",
    ],
  },

  urania: {
    museKey: "urania",
    displayName: "Urania",
    mission:
      "Strengthen Urania's guidance for wonder, dreams, cosmic imagery, transcendence, mystery, scale, imagination, and the use of science or the heavens as metaphor.",
    targetCapabilities: [
      "wonder",
      "dream imagery",
      "cosmic perspective",
      "transcendence and mystery",
      "science and scale as metaphor",
    ],
  },
};

export function getMuseProfile(
  museKey: string,
) {
  const profile = MUSE_PROFILES[museKey];
  if (!profile) {
    throw new Error(`Unsupported Muse: ${museKey}`);
  }
  return profile;
}

const ALL_MUSE_KEYS = [
  "calliope",
  "clio",
  "erato",
  "euterpe",
  "melpomene",
  "polyhymnia",
  "terpsichore",
  "thalia",
  "urania",
];

const FIRST_SWEEP_KEYS = [
  "clio",
  "erato",
  "euterpe",
  "melpomene",
  "polyhymnia",
  "terpsichore",
  "thalia",
  "urania",
];

function buildTargets({
  museKeys,
  depth,
}: {
  museKeys: string[];
  depth: number;
}): MuseSweepTarget[] {
  const suffix =
    String(depth).padStart(
      2,
      "0",
    );

  return museKeys.map(
    (museKey) => {
      const profile =
        MUSE_PROFILES[museKey];

      if (!profile) {
        throw new Error(
          `Unsupported Muse Sweep target: ${museKey}`,
        );
      }

      return {
        ...profile,
        candidateVersion:
          `${museKey}-depth-agent-${suffix}`,
      };
    },
  );
}

/*
 * Historical definition.
 *
 * Calliope Depth Agent 01 was completed separately before
 * the first eight-Muse orchestrated sweep. Do not add her
 * to this historical definition.
 */
const FIRST_PASS_V1: MuseSweepDefinition = {
  sweepKey:
    "nine-muses-first-pass-v1",
  sweepVersion: 1,
  depth: 1,
  displayName:
    "Muse Sweep v1",
  baselineVersion:
    "muse-iq-v1.2",
  requestedSourceCount: 10,
  targets:
    buildTargets({
      museKeys:
        FIRST_SWEEP_KEYS,
      depth: 1,
    }),
};

/*
 * Next-generation all-nine-Muse sweep.
 *
 * Defining this does NOT create or execute jobs.
 * It remains dormant until explicitly selected and started.
 */
const DEPTH_AGENT_02: MuseSweepDefinition = {
  sweepKey:
    "nine-muses-depth-agent-02",
  sweepVersion: 2,
  depth: 2,
  displayName:
    "Muse Sweep Depth Agent 02",
  baselineVersion:
    "muse-iq-v1.2",
  requestedSourceCount: 10,
  targets:
    buildTargets({
      museKeys:
        ALL_MUSE_KEYS,
      depth: 2,
    }),
};

const REMAINING_DEPTH_AGENT_02: MuseSweepDefinition = {
  sweepKey:
    "seven-muses-depth-agent-02",
  sweepVersion: 1,
  depth: 2,
  displayName:
    "Remaining Seven Muses Depth-02",
  baselineVersion:
    "muse-iq-v1.2",
  requestedSourceCount: 10,
  targets:
    buildTargets({
      museKeys: [
        "clio",
        "erato",
        "euterpe",
        "melpomene",
        "polyhymnia",
        "terpsichore",
        "thalia",
      ],
      depth: 2,
    }),
};

export const MUSE_SWEEP_DEFINITIONS:
  Record<
    string,
    MuseSweepDefinition
  > = {
    [FIRST_PASS_V1.sweepKey]:
      FIRST_PASS_V1,

    [DEPTH_AGENT_02.sweepKey]:
      DEPTH_AGENT_02,

    [REMAINING_DEPTH_AGENT_02.sweepKey]:
      REMAINING_DEPTH_AGENT_02,
  };

export const DEFAULT_MUSE_SWEEP_KEY =
  FIRST_PASS_V1.sweepKey;

export function getMuseSweepDefinition(
  sweepKey:
    string =
      DEFAULT_MUSE_SWEEP_KEY,
) {
  const definition =
    MUSE_SWEEP_DEFINITIONS[
      sweepKey
    ];

  if (!definition) {
    throw new Error(
      `Unknown Muse Sweep definition: ${sweepKey}`,
    );
  }

  return definition;
}
