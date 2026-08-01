export type ExampleSong = {
  title: string;
  artist: string;
  note: string;
};

export const siteMeta = {
  title: 'iDreamMusic',
  tagline: 'Songs are caught, not written.',
  description:
    'Songs are caught, not written. A shared creative home for songcatchers following the Nine Muses.',
};

export const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/nine-muses', label: 'Nine Muses' },
  { href: '/book', label: 'Book' },
  { href: '/listen', label: 'Listen' },
  { href: '/studio', label: 'Studio' },
  { href: '/about', label: 'About' },
];

export type MuseDefinition = {
  slug: string;
  name: string;
  label: string;
  teaser: string;
  description: string;
  image: string;
  symbol: string;
  heroSubtitle: string;
  closing: string;
  whatThisMuseIs: string;
  current: string;
  recognize: string;
  emotionalTerritory: string[];
  genres: string[];
  lyricalThemes: string[];
  dreamDescription: string;
  firstDraft: string;
  finalSong: string;
  exampleSongs: ExampleSong[];
  forCreators: string;
  related: string[];
  tagline?: string;
  iconTag?: string;
  cardImage?: string;
};

export const veiledMuse: MuseDefinition = {
  slug: 'veiled',
  name: 'The Veiled Muse',
  label: 'Unknown Current',
  teaser: 'For songs whose source has not yet revealed itself.',
  description:
    'Some songs arrive before they can be named. The Veiled Muse holds sparks whose true current is still forming.',
  image: '/muses/shared/Veiled.png',
  cardImage: '/muses/shared/veiled-card.png',
  symbol: 'Veil • Lantern',
  tagline: 'Not-aMused-Yet',
  iconTag: 'VEIL • LANTERN',
  heroSubtitle:
    'This is the threshold before the true current becomes known.',
  closing:
    'Not every song announces its source on arrival. Some must be held gently until they reveal their deeper name.',
  whatThisMuseIs:
    'The Veiled Muse is not one of the nine named currents. It is the holding place for sparks that are real but not yet clearly story, love, roots, blues, rhythm, faith, play, dream, or craft.',
  current:
    'A half-seen arrival. A phrase without a home yet. A melody without a known emotional center. A song whose truest source is still behind the veil.',
  recognize:
    'You know you are in the Veiled Muse when a song feels alive but premature to classify — when forcing it into a category would flatten it.',
  emotionalTerritory: [
    'uncertainty',
    'potential',
    'emergence',
    'becoming',
    'intuition',
  ],
  genres: [
    'unfinished sparks',
    'raw fragments',
    'nascent songs',
    'unformed sketches',
  ],
  lyricalThemes: [
    'not yet named',
    'first arrival',
    'the hidden source',
    'songs still becoming',
  ],
  dreamDescription:
    'A spark appears, but its meaning remains folded. The song is here — but the current behind it is still concealed.',
  firstDraft:
    'The first draft often reveals whether the song belongs to Story, Love, Blues, Roots, Dream, or somewhere else entirely.',
  finalSong:
    'A final song leaves the Veiled Muse only when its truest current becomes clear.',
  exampleSongs: [
    {
      title: 'Untitled Fragment',
      artist: 'Songcatcher',
      note: 'An example of a real spark that has not yet shown its full source.',
    },
  ],
  forCreators:
    'Use The Veiled Muse for sparks that feel genuine but premature to define. It is better to hold a song faithfully than misname it too soon.',
  related: [
    'Calliope',
    'Erato',
    'Melpomene',
    'Urania',
    'all of the Nine Muses',
  ],
};

export const muses: MuseDefinition[] = [
  {
    slug: 'calliope',
    name: 'Calliope',
    label: 'Story',
    teaser: 'Songs of narrative, memory, place, and tale.',
    description:
      'Calliope is the current of story — songs carried by scene, character, memory, movement, and the need to tell.',
    image: '/muses/default/calliope.png',
    symbol: 'Scroll • Lantern',
    heroSubtitle:
      'Calliope holds the songs that arrive as scenes, journeys, characters, and remembered worlds.',
    closing:
      'When a song comes bearing place, image, and unfolding meaning, Calliope is often near.',
    whatThisMuseIs:
      'Calliope is the current of narrative song. She governs the songs that move through image, memory, sequence, and the arc of a lived or imagined story.',
    current:
      'Roads, names, rooms, weather, turning points, characters, and remembered moments. Calliope songs often feel cinematic.',
    recognize:
      'You know Calliope is present when the song wants to tell what happened, where it happened, and why it matters.',
    emotionalTerritory: [
      'memory',
      'journey',
      'meaning',
      'identity',
      'witness',
    ],
    genres: [
      'story song',
      'roots rock',
      'country narrative',
      'folk',
      'Americana',
    ],
    lyricalThemes: [
      'roads',
      'characters',
      'places',
      'memory',
      'turning points',
    ],
    dreamDescription:
      'The song arrives as a scene, a road, a room, a face, or a voice from another time.',
    firstDraft:
      'Drafting a Calliope song usually means discovering the arc: who is speaking, what happened, and what must be remembered.',
    finalSong:
      'A final Calliope song feels lived in. It carries details that make it believable and emotionally grounded.',
    exampleSongs: [
      {
        title: 'Tattoo Road',
        artist: 'Mike Mancour',
        note: 'A strong example of a song led by imagery, place, and narrative pull.',
      },
      {
        title: 'Pancho and Lefty',
        artist: 'Townes Van Zandt',
        note: 'Classic story-song architecture.',
      },
    ],
    forCreators:
      'Follow the image. Trust the place. Let the song tell the truth through scene and movement.',
    related: ['Clio', 'Urania', 'Thalia'],
  },
  {
    slug: 'clio',
    name: 'Clio',
    label: 'Roots',
    teaser: 'Songs of inheritance, place, lineage, and belonging.',
    description:
      'Clio is the current of roots, origin, home, memory, ancestry, and the way music carries history through a life.',
    image: '/muses/default/clio.png',
    symbol: 'Branch • Old Key',
    heroSubtitle:
      'Clio holds the songs that remember where we come from and what still lives inside us from those roots.',
    closing:
      'When a song bears inheritance, place, bloodline, or cultural memory, Clio is listening.',
    whatThisMuseIs:
      'Clio is the current of roots and remembrance. She holds songs grounded in geography, family, tradition, lineage, and inherited identity.',
    current:
      'Back roads, hometowns, elders, vanished places, inherited pain, remembered voices, and the durable pull of origin.',
    recognize:
      'You know Clio is present when the song is less about plot and more about where the singer comes from.',
    emotionalTerritory: [
      'belonging',
      'memory',
      'inheritance',
      'home',
      'identity',
    ],
    genres: [
      'Americana',
      'folk',
      'roots',
      'country',
      'blues-rooted song',
    ],
    lyricalThemes: [
      'home',
      'family',
      'place',
      'ancestry',
      'remembering',
    ],
    dreamDescription:
      'The song arrives carrying a place, a soil, a family echo, or a cultural memory.',
    firstDraft:
      'Clio drafts often clarify what the singer is inheriting and what they are trying to preserve or understand.',
    finalSong:
      'A final Clio song feels rooted — connected to something older than the present moment.',
    exampleSongs: [
      {
        title: 'Coat of Many Colors',
        artist: 'Dolly Parton',
        note: 'A deeply rooted song of memory and identity.',
      },
      {
        title: 'The Night They Drove Old Dixie Down',
        artist: 'The Band',
        note: 'History and human memory braided together.',
      },
    ],
    forCreators:
      'Trust the details of home, blood, place, and inheritance. Roots songs deepen when they stay specific.',
    related: ['Calliope', 'Melpomene', 'Polyhymnia'],
  },
  {
    slug: 'erato',
    name: 'Erato',
    label: 'Love',
    teaser: 'Songs of longing, tenderness, heartbreak, and devotion.',
    description:
      'Erato is the current of desire, intimacy, heartbreak, memory of love, and the ache of closeness or absence.',
    image: '/muses/default/erato.png',
    symbol: 'Heart • Rose',
    heroSubtitle:
      'Erato holds the songs that come through love — found love, lost love, wanted love, remembered love.',
    closing:
      'When a song centers the heart’s attachment, Erato is usually near.',
    whatThisMuseIs:
      'Erato is the current of love and relational longing. She governs songs of romantic connection, absence, tenderness, regret, and devotion.',
    current:
      'Breakups, yearning, desire, tenderness, reconciliation, loneliness, and the emotional weather left by someone else.',
    recognize:
      'You know Erato is present when the emotional center of the song is shaped by relationship.',
    emotionalTerritory: [
      'longing',
      'heartbreak',
      'tenderness',
      'desire',
      'devotion',
    ],
    genres: [
      'love song',
      'ballad',
      'country',
      'soul',
      'soft rock',
    ],
    lyricalThemes: [
      'absence',
      'touch',
      'regret',
      'romance',
      'return',
    ],
    dreamDescription:
      'The song arrives as a feeling of missing, wanting, remembering, or reaching toward someone.',
    firstDraft:
      'Drafting an Erato song means finding the emotional truth beneath the first line of loss or desire.',
    finalSong:
      'A final Erato song feels exposed and emotionally clear, even when it is understated.',
    exampleSongs: [
      {
        title: "Since You've Been Gone",
        artist: 'Mike Mancour',
        note: 'A strong example of Erato’s heartbreak-and-recovery lane.',
      },
      {
        title: 'Without You',
        artist: 'Mike Mancour',
        note: 'Absence and relationship-centered emotion make this a natural Erato song.',
      },
    ],
    forCreators:
      'Do not protect yourself too much in an Erato song. The truth is usually in what hurts, yearns, or still hopes.',
    related: ['Melpomene', 'Urania', 'Calliope'],
  },
  {
    slug: 'euterpe',
    name: 'Euterpe',
    label: 'Craft',
    teaser: 'Songs of musical design, structure, melody, and making.',
    description:
      'Euterpe is the current of musical craft — the joy of shape, phrase, movement, precision, and sonic design.',
    image: '/muses/default/euterpe.png',
    symbol: 'Flute • Feather',
    heroSubtitle:
      'Euterpe holds the songs that come first through sound, form, movement, and musical intelligence.',
    closing:
      'When the craft of the song itself is the source of delight, Euterpe is at work.',
    whatThisMuseIs:
      'Euterpe is the current of craftsmanship in song — melody, pacing, line, form, sonic architecture, and compositional beauty.',
    current:
      'Hooks, arrangements, phrasing, harmony, rhythm placement, and the pleasure of building something elegant.',
    recognize:
      'You know Euterpe is present when the song arrives more through musical shape than through emotional story alone.',
    emotionalTerritory: [
      'focus',
      'design',
      'precision',
      'beauty',
      'musical intelligence',
    ],
    genres: [
      'art pop',
      'singer-songwriter',
      'jazz-pop',
      'carefully arranged song',
    ],
    lyricalThemes: [
      'less theme-driven',
      'more form-driven',
      'crafted expression',
    ],
    dreamDescription:
      'The song arrives as a hook, a movement, a chord shape, a phrasing pattern, or a melodic contour.',
    firstDraft:
      'Drafting an Euterpe song often means honoring the structure that first appeared and protecting its elegance.',
    finalSong:
      'A final Euterpe song feels intentional, balanced, and musically articulate.',
    exampleSongs: [
      {
        title: 'Peg',
        artist: 'Steely Dan',
        note: 'A high-craft song with strong Euterpe energy.',
      },
      {
        title: 'Rikki Don’t Lose That Number',
        artist: 'Steely Dan',
        note: 'Form, sophistication, and musical design.',
      },
    ],
    forCreators:
      'Trust your ear. Let craft be a source, not just a finishing tool.',
    related: ['Terpsichore', 'Urania', 'Calliope'],
  },
  {
    slug: 'melpomene',
    name: 'Melpomene',
    label: 'Blues',
    teaser: 'Songs of ache, truth, sorrow, grit, and soul-depth.',
    description:
      'Melpomene is the current of blues, grief, ache, hard truth, emotional gravity, and the music that tells it plain.',
    image: '/muses/default/melpomene.png',
    symbol: 'Mask • Black Rose',
    heroSubtitle:
      'Melpomene holds the songs that come from hurt, endurance, sorrow, confession, and the honesty that survives them.',
    closing:
      'When the song bleeds truth and refuses prettiness, Melpomene is often the one speaking.',
    whatThisMuseIs:
      'Melpomene is the current of sorrow, ache, gravity, and the redemptive honesty of pain. She includes blues, lament, and emotionally serious truth-telling.',
    current:
      'Loss, grit, loneliness, consequence, weathered endurance, confession, and soul-deep ache.',
    recognize:
      'You know Melpomene is present when the song refuses sentimentality and tells the wound directly.',
    emotionalTerritory: [
      'ache',
      'grief',
      'truth',
      'weariness',
      'endurance',
    ],
    genres: [
      'blues',
      'soul',
      'blues rock',
      'lament',
      'dark Americana',
    ],
    lyricalThemes: [
      'hurt',
      'endurance',
      'distance',
      'loss',
      'hard truth',
    ],
    dreamDescription:
      'The song arrives with heaviness, a wound, a worn-out truth, or a voice that has paid for what it knows.',
    firstDraft:
      'Drafting a Melpomene song means stripping away prettiness until the truth is left standing.',
    finalSong:
      'A final Melpomene song feels earned. It carries weight and does not apologize for it.',
    exampleSongs: [
      {
        title: 'Streets of Clarksdale',
        artist: 'Mike Mancour',
        note: 'A strong Melpomene candidate through blues geography and emotional gravity.',
      },
      {
        title: 'The Thrill Is Gone',
        artist: 'B.B. King',
        note: 'Classic Melpomene energy.',
      },
    ],
    forCreators:
      'Say the hard thing plainly. Melpomene songs deepen when they do not flinch.',
    related: ['Erato', 'Clio', 'Polyhymnia'],
  },
  {
    slug: 'polyhymnia',
    name: 'Polyhymnia',
    label: 'Faith',
    teaser: 'Songs of reverence, prayer, wonder, and sacred attention.',
    description:
      'Polyhymnia is the current of faith, sacred attention, devotion, reverence, and songs that listen for what is greater.',
    image: '/muses/default/polyhymnia.png',
    symbol: 'Temple • Laurel',
    heroSubtitle:
      'Polyhymnia holds the songs that arrive through prayer, awe, devotion, confession, and spiritual hunger.',
    closing:
      'When a song bows before mystery, grace, or the holy, Polyhymnia is near.',
    whatThisMuseIs:
      'Polyhymnia is the current of sacred song — faith, reverence, wonder, lament before God, and spiritual seriousness.',
    current:
      'Prayer, mercy, worship, confession, grace, spiritual longing, and the search for meaning before the eternal.',
    recognize:
      'You know Polyhymnia is present when the song is oriented upward, inward, or beyond the merely personal.',
    emotionalTerritory: [
      'reverence',
      'awe',
      'grace',
      'confession',
      'hope',
    ],
    genres: [
      'faith song',
      'gospel-rooted',
      'spiritual ballad',
      'devotional song',
    ],
    lyricalThemes: [
      'prayer',
      'grace',
      'mercy',
      'wonder',
      'surrender',
    ],
    dreamDescription:
      'The song arrives with stillness, reverence, or the unmistakable sense that it was received rather than made.',
    firstDraft:
      'Drafting a Polyhymnia song often means protecting its sincerity and resisting over-cleverness.',
    finalSong:
      'A final Polyhymnia song feels honest, prayerful, and spiritually alive.',
    exampleSongs: [
      {
        title: 'Amazing Grace',
        artist: 'Traditional',
        note: 'A classic faith-current example.',
      },
      {
        title: 'I Can Only Imagine',
        artist: 'MercyMe',
        note: 'Wonder and sacred longing.',
      },
    ],
    forCreators:
      'Do not force holiness into language that is too polished. Sacred songs need truth more than ornament.',
    related: ['Clio', 'Melpomene', 'Urania'],
  },
  {
    slug: 'terpsichore',
    name: 'Terpsichore',
    label: 'Rhythm',
    teaser: 'Songs of groove, motion, pulse, and embodied life.',
    description:
      'Terpsichore is the current of rhythm — the music that leads through movement, groove, pulse, dance, and body-memory.',
    image: '/muses/default/terpsichore.png',
    symbol: 'Drum • Dancer',
    heroSubtitle:
      'Terpsichore holds the songs that arrive through movement, beat, drive, and the body’s need to respond.',
    closing:
      'When the song begins in pulse rather than plot, Terpsichore is already dancing.',
    whatThisMuseIs:
      'Terpsichore is the current of rhythm and movement. She governs groove-first songs, dance-energy, and music whose life begins in pulse.',
    current:
      'Drive, feel, swing, pocket, movement, heat, syncopation, and embodied musical instinct.',
    recognize:
      'You know Terpsichore is present when the song begins in the body before it begins in the mind.',
    emotionalTerritory: [
      'motion',
      'release',
      'heat',
      'energy',
      'embodiment',
    ],
    genres: [
      'dance groove',
      'funk',
      'groove rock',
      'rhythm-heavy pop',
      'R&B',
    ],
    lyricalThemes: [
      'movement',
      'night',
      'heat',
      'momentum',
      'body-memory',
    ],
    dreamDescription:
      'The song arrives as beat, pulse, movement, or a repeating rhythmic figure that insists on being followed.',
    firstDraft:
      'Drafting a Terpsichore song means preserving feel. The groove is usually the truth source.',
    finalSong:
      'A final Terpsichore song feels alive in the body and impossible to hear without moving.',
    exampleSongs: [
      {
        title: 'Gimme Some Lovin’',
        artist: 'Spencer Davis Group',
        note: 'A strong rhythm-driven example.',
      },
      {
        title: 'Working for a Living',
        artist: 'Huey Lewis',
        note: 'Rhythm and drive lead the experience.',
      },
    ],
    forCreators:
      'Don’t over-explain what the groove is already saying.',
    related: ['Euterpe', 'Thalia', 'Erato'],
  },
  {
    slug: 'thalia',
    name: 'Thalia',
    label: 'Play',
    teaser: 'Songs of wit, character, humor, energy, and delight.',
    description:
      'Thalia is the current of play — wit, grin, character, swagger, levity, theatricality, and bright songcraft.',
    image: '/muses/default/thalia.png',
    symbol: 'Mask • Ivy',
    heroSubtitle:
      'Thalia holds the songs that arrive with mischief, delight, personality, and the freedom not to be heavy.',
    closing:
      'When a song smiles, struts, jokes, teases, or charms, Thalia is usually somewhere nearby.',
    whatThisMuseIs:
      'Thalia is the current of playfulness, wit, lightness, theatrical delight, and songs that enjoy themselves.',
    current:
      'Character songs, humor, wit, sparkle, swagger, playful language, and emotional lift.',
    recognize:
      'You know Thalia is present when the song wants to grin at the listener or dance around seriousness without losing substance.',
    emotionalTerritory: [
      'delight',
      'wit',
      'swagger',
      'humor',
      'lightness',
    ],
    genres: [
      'playful rock',
      'character song',
      'novelty with substance',
      'clever pop',
    ],
    lyricalThemes: [
      'characters',
      'wit',
      'banter',
      'energy',
      'mischief',
    ],
    dreamDescription:
      'The song arrives with a grin, a character voice, a rhythm of mischief, or a line that knows it is charming.',
    firstDraft:
      'Drafting a Thalia song means protecting the spark of delight and avoiding over-explaining the joke or character.',
    finalSong:
      'A final Thalia song feels alive, clever, and effortless — even if it took work to make it feel that way.',
    exampleSongs: [
      {
        title: 'Shaky Jake',
        artist: 'Mike Mancour',
        note: 'A likely Thalia song if the character and energy stay front and center.',
      },
      {
        title: 'WhoDoVooDoo',
        artist: 'Mike Mancour',
        note: 'Playful title energy makes this a strong Thalia candidate.',
      },
    ],
    forCreators:
      'Let the song enjoy itself. Play is not the enemy of depth.',
    related: ['Terpsichore', 'Calliope', 'Urania'],
  },
  {
    slug: 'urania',
    name: 'Urania',
    label: 'Dream',
    teaser: 'Songs of vision, symbol, wonder, dream, and skyward imagination.',
    description:
      'Urania is the current of dream, symbol, imagination, vision, skyward wonder, and songs that come from beyond ordinary logic.',
    image: '/muses/default/urania.png',
    symbol: 'Star • Astrolabe',
    heroSubtitle:
      'Urania holds the songs that arrive through dream, symbol, mystery, vision, or the strangely luminous image.',
    closing:
      'When a song comes from beyond the plainspoken world, Urania is often the guide.',
    whatThisMuseIs:
      'Urania is the current of dream and vision. She governs songs born through symbol, spiritual image, surreal association, wonder, and the not-quite-explainable.',
    current:
      'Stars, dreams, symbols, visitations, strange images, skyward thought, intuitive knowing, and poetic mystery.',
    recognize:
      'You know Urania is present when the song feels received through image and wonder rather than ordinary explanation.',
    emotionalTerritory: [
      'wonder',
      'vision',
      'mystery',
      'intuition',
      'imagination',
    ],
    genres: [
      'dream song',
      'poetic ballad',
      'visionary folk',
      'art song',
    ],
    lyricalThemes: [
      'stars',
      'dreams',
      'symbols',
      'the unseen',
      'night-sky imagination',
    ],
    dreamDescription:
      'The song arrives in symbol, image, visitation, or a phrase that feels more revealed than invented.',
    firstDraft:
      'Drafting a Urania song means listening for the hidden logic inside the dream image.',
    finalSong:
      'A final Urania song remains mysterious without becoming empty. It keeps its wonder and its emotional truth.',
    exampleSongs: [
      {
        title: 'MysteryBookLover',
        artist: 'Mike Mancour',
        note: 'A likely Urania song if its inner world stays strange, symbolic, and imaginative.',
      },
      {
        title: 'Vincent',
        artist: 'Don McLean',
        note: 'Vision, beauty, and poetic perception.',
      },
    ],
    forCreators:
      'Do not flatten dream into explanation too soon. Let the image keep its charge.',
    related: ['Calliope', 'Erato', 'Polyhymnia'],
  },
];

export const selectableMuses: MuseDefinition[] = [veiledMuse, ...muses];

export const featuredSongStages = [
  {
    title: 'Stage 1 — Spark',
    description:
      'A first arrival: a phrase, a melody, a feeling, a title, a voice memo, or a dream fragment that deserves to be caught before it disappears.',
  },
  {
    title: 'Stage 2 — Draft',
    description:
      'The song begins to reveal its shape. Lyrics connect, melody settles, structure emerges, and the current becomes more visible.',
  },
  {
    title: 'Stage 3 — Final',
    description:
      'The song reaches offering form — not because it is perfect, but because it is ready to be shared as a finished expression.',
  },
];
