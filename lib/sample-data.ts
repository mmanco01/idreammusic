import type { SongDetail, SongSummary } from '@/lib/types';

export const sampleSongs: SongSummary[] = [
  {
    id: 'sample-1',
    slug: 'midnight-harbor',
    title: 'Midnight Harbor',
    hook_line: 'I saw the harbor in a dream before daylight hit the water.',
    summary: 'A dreamborne song moving from voice memo to full narrative ballad.',
    current_stage: 'draft',
    muse_slug: 'urania',
    current_labels: ['dreamborne', 'storyborne'],
    audio_url: null,
    audio_title: null
  },
  {
    id: 'sample-2',
    slug: 'second-hand-halo',
    title: 'Second-Hand Halo',
    hook_line: 'Mercy showed up wearing work boots.',
    summary: 'A faith-and-roots piece already published as a final song.',
    current_stage: 'final',
    muse_slug: 'polyhymnia',
    current_labels: ['faithborne', 'roots'],
    audio_url: null,
    audio_title: null
  }
];

export const sampleSongDetail: SongDetail = {
  ...sampleSongs[0],
  notes: [
    {
      id: 'note-1',
      title: 'Dream note',
      body: 'Woke up with the image of ships and a line about mercy arriving late. This can stay private if the writer wants.',
      visibility: 'private',
      created_at: new Date().toISOString()
    },
    {
      id: 'note-2',
      title: 'Public process note',
      body: 'The chorus did not appear first. The image did. I followed the image until the melody revealed itself.',
      visibility: 'public',
      created_at: new Date().toISOString()
    }
  ],
  versions: [
    {
      id: 'version-1',
      version_number: 1,
      stage: 'spark',
      title: 'Midnight Harbor',
      lyrics: 'midnight harbor / cold blue flame / somebody called me by my hidden name',
      arrangement_notes: 'Voice memo only. Free tempo.',
      story_behind_song: 'Captured right after waking.',
      is_stage_primary: false,
      created_at: new Date().toISOString()
    },
    {
      id: 'version-2',
      version_number: 2,
      stage: 'draft',
      title: 'Midnight Harbor',
      lyrics: 'Verse 1...\n\nChorus...',
      arrangement_notes: 'Slow 6/8. Acoustic guitar and ambient electric swells.',
      story_behind_song: 'Expanded from the voice memo into a full first draft.',
      is_stage_primary: true,
      created_at: new Date().toISOString()
    }
  ],
  posts: [
    {
      id: 'post-1',
      title: 'Where Midnight Harbor came from',
      excerpt: 'A short journal post connecting the dream image to the first lyric line.',
      approval_status: 'approved',
      published_at: new Date().toISOString()
    }
  ],
  attachments: []
};
