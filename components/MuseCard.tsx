import Link from 'next/link';
import Image from 'next/image';

type Muse = {
  slug: string;
  name: string;
  label: string;
  teaser?: string;
  image: string;
};

type Props = {
  muse: Muse;
  imageOverride?: string;
};

export default function MuseCard({ muse, imageOverride }: Props) {
  return (
    <Link href={`/muses/${muse.slug}`} className="card muse-card">
      <div className="oval-frame">
        <div className="oval-inner image-oval">
          <Image
            src={imageOverride ?? muse.image}
            alt={muse.name}
            fill
            className="muse-image"
            sizes="(max-width: 980px) 100vw, 20vw"
          />
          <div className="image-overlay" />
        </div>
      </div>

      <div className="eyebrow">{muse.name}</div>
      <h3 className="h3">{muse.label}</h3>
      {muse.teaser ? <p className="copy">{muse.teaser}</p> : null}
    </Link>
  );
}