import { getMyMuseRepresentationTheme } from '@/lib/profile';
import { saveMuseRepresentationTheme } from './actions';
import { MuseRepresentationForm } from './MuseRepresentationForm';

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

          <MuseRepresentationForm
            initialTheme={theme}
            action={saveMuseRepresentationTheme}
          />
        </div>
      </div>
    </section>
  );
}