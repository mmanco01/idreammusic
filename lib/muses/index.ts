import { calliope } from "@/lib/muses/calliope";
import { clio } from "@/lib/muses/clio";
import { erato } from "@/lib/muses/erato";
import { euterpe } from "@/lib/muses/euterpe";
import { melpomene } from "@/lib/muses/melpomene";
import { polyhymnia } from "@/lib/muses/polyhymnia";
import { terpsichore } from "@/lib/muses/terpsichore";
import { thalia } from "@/lib/muses/thalia";
import { urania } from "@/lib/muses/urania";
import type { MuseIdentity, MuseSlug } from "@/lib/muses/types";

export type { MuseIdentity, MuseSlug } from "@/lib/muses/types";

export const MUSES: MuseIdentity[] = [
  calliope,
  clio,
  erato,
  euterpe,
  melpomene,
  polyhymnia,
  terpsichore,
  thalia,
  urania,
];

const museBySlug = new Map<MuseSlug, MuseIdentity>(
  MUSES.map((muse) => [muse.slug, muse]),
);

export function getMuseBySlug(value: unknown): MuseIdentity | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase() as MuseSlug;

  return museBySlug.get(normalized) ?? null;
}

export const MUSE_OPTIONS = MUSES.map((muse) => ({
  slug: muse.slug,
  name: muse.name,
  domain: muse.domain,
  label: muse.label,
  greeting: muse.greeting,
  starterQuestions: muse.starterQuestions,
}));

export {
  calliope,
  clio,
  erato,
  euterpe,
  melpomene,
  polyhymnia,
  terpsichore,
  thalia,
  urania,
};
