export type MuseRepresentationTheme =
  | 'default'
  | 'european_heritage'
  | 'african_american_heritage'
  | 'latinx_hispanic_indigenous_americas'
  | 'asian_heritage';

export const museRepresentationOptions: Array<{
  value: MuseRepresentationTheme;
  label: string;
  description: string;
}> = [
  {
    value: 'default',
    label: 'Default',
    description: 'Use the site default Muse artwork.',
  },
  {
    value: 'european_heritage',
    label: 'European Heritage',
    description: 'European visual representation of the Muses.',
  },
  {
    value: 'african_american_heritage',
    label: 'African American Heritage',
    description: 'African American visual representation of the Muses.',
  },
  {
    value: 'latinx_hispanic_indigenous_americas',
    label: 'Latinx / Hispanic / Indigenous Americas Heritage',
    description:
      'Latinx, Hispanic, and Indigenous Americas visual representation of the Muses.',
  },
  {
    value: 'asian_heritage',
    label: 'Asian Heritage',
    description: 'Asian visual representation of the Muses.',
  },
];

export function resolveMuseImage(
  slug: string,
  defaultImage: string,
  theme: MuseRepresentationTheme | null | undefined
) {
  if (!theme || theme === 'default') return defaultImage;
  return `/muses/${theme}/${slug}.png`;
}