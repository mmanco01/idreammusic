import Image from 'next/image';
import { getMyMuseRepresentationTheme } from '@/lib/profile';
import {
  museRepresentationOptions,
  resolveMuseImage,
} from '@/lib/muse-representation';
import { saveMuseRepresentationTheme } from './actions';
import { muses } from '@/content/site';

export default async function MuseRepresentationPage() {
  const theme = await getMyMuseRepresentationTheme();

  return (
    <section className="section">
      <div className="container">
        <div className="card">
          <div className="eyebrow">Profile settings</div>
          <h1 className="h2">Muse Representation</h1>
          <p className="copy" style={{ maxWidth: 860 }}>
            Choose the visual heritage theme for how the Muse artwork appears
            across iDreamMusic. This changes the artwork only, not the meanings
            of the Muses or the song categories.
          </p>

          <form action={saveMuseRepresentationTheme}>
            <div className="section-tight" />

            <div className="card-grid">
              {museRepresentationOptions.map((option) => {
                const checked = theme === option.value;

                return (
                  <label
                    key={option.value}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border: checked
                        ? '1px solid rgba(214, 176, 72, 0.45)'
                        : undefined,
                    }}
                  >
                    <div className="pillRow" style={{ marginBottom: '0.8rem' }}>
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        defaultChecked={checked}
                      />
                      <span className="pill">{option.label}</span>
                    </div>

                    <h3 className="h3">{option.label}</h3>
                    <p className="copy">{option.description}</p>
                  </label>
                );
              })}
            </div>

            <div className="section-tight" />

            <div className="card">
              <div className="eyebrow">Preview</div>
              <h2 className="h2">How the Muses will appear</h2>

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

            <div className="button-row" style={{ marginTop: '1rem' }}>
              <button type="submit" className="button primary">
                Save changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}