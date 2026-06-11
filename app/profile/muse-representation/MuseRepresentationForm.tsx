'use client';

import { useState } from 'react';
import Image from 'next/image';
import { muses } from '@/content/site';
import {
  museRepresentationOptions,
  resolveMuseImage,
  type MuseRepresentationTheme,
} from '@/lib/muse-representation';

type Props = {
  initialTheme: MuseRepresentationTheme;
  action: (formData: FormData) => void;
};

export function MuseRepresentationForm({ initialTheme, action }: Props) {
  const [theme, setTheme] = useState<MuseRepresentationTheme>(initialTheme);

  return (
    <form action={action}>
      <input type="hidden" name="theme" value={theme} />

      <div className="card-grid">
        {museRepresentationOptions.map((option) => {
          const checked = theme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className="card"
              onClick={() => setTheme(option.value)}
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: checked
                  ? '1px solid rgba(214, 176, 72, 0.45)'
                  : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div className="pillRow" style={{ marginBottom: '0.8rem' }}>
                <span className="pill">{checked ? 'Selected' : 'Select'}</span>
                <span className="pill">{option.label}</span>
              </div>

              <h3 className="h3">{option.label}</h3>
              <p className="copy">{option.description}</p>
            </button>
          );
        })}
      </div>

      <div className="button-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <button type="submit" className="button primary">
          Save changes
        </button>
      </div>

      <div className="card">
        <div className="eyebrow">Live preview</div>
        <h2 className="h2">How the Muses will appear</h2>
        <p className="copy" style={{ maxWidth: 760 }}>
          Selecting a heritage updates this preview immediately. Click save when
          you want to apply it across the site.
        </p>

        <div className="muse-grid">
          {muses.map((muse) => {
            const imageSrc = resolveMuseImage(muse.slug, muse.image, theme);

            return (
              <div key={muse.slug} className="card">
                <div className="oval-frame">
                  <div className="oval-inner image-oval">
                    <Image
                      src={imageSrc}
                      alt={`${muse.name} preview`}
                      fill
                      className="muse-image"
                      sizes="(max-width: 980px) 100vw, 20vw"
                    />
                    <div className="image-overlay" />
                  </div>
                </div>
                <div className="eyebrow">{muse.name}</div>
                <h3 className="h3">{muse.label}</h3>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
}