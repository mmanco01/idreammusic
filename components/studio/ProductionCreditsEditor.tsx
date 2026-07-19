import { saveProductionCredits } from "@/app/studio/songs/[slug]/edit/credit-actions";
import {
  PRODUCTION_CREDIT_FIELDS,
  productionCreditsToMap,
  type ProductionCreditRow,
} from "@/lib/production-credits";

type Props = {
  songId: string;
  songVersionId: string;
  slug: string;
  versionNumber?: number | null;
  existingCredits: ProductionCreditRow[];
  defaultSongwriter?: string | null;
};

export function ProductionCreditsEditor({
  songId,
  songVersionId,
  slug,
  versionNumber,
  existingCredits,
  defaultSongwriter,
}: Props) {
  const creditMap = productionCreditsToMap(existingCredits);
  const creditsArePublic =
    existingCredits.length === 0 ||
    existingCredits.some((credit) => credit.is_public !== false);

  return (
    <section
      id="credits"
      className="card"
      style={{
        border: "1px solid rgba(220, 182, 92, 0.42)",
        background:
          "linear-gradient(145deg, rgba(151, 106, 40, 0.12), rgba(255,255,255,0.025))",
      }}
    >
      <div className="eyebrow">
        Human &amp; creative technology
      </div>

      <h2 className="h2">Production Credits</h2>

      <p className="copy" style={{ maxWidth: 900 }}>
        Credit the people and tools that helped bring this
        specific version to life. The wording keeps human
        authorship and creative direction clear while documenting
        music, voice, video, and artwork technology transparently.
      </p>

      <div className="quote-panel">
        Written and creatively directed by people. Assisted by
        selected technology where credited.
      </div>

      <form
        action={saveProductionCredits}
        style={{ marginTop: "1rem" }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="song_id" value={songId} />
        <input
          type="hidden"
          name="song_version_id"
          value={songVersionId}
        />

        <div
          className="pillRow"
          style={{ marginBottom: "1rem" }}
        >
          {versionNumber ? (
            <span className="pill">
              Version {versionNumber}
            </span>
          ) : null}

          <span className="pill">
            Credits belong to this version
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
            gap: "1rem",
          }}
        >
          {PRODUCTION_CREDIT_FIELDS.map((field) => {
            const fallback =
              field.key === "lyrics_songwriting" ||
              field.key === "creative_direction"
                ? defaultSongwriter || ""
                : "";

            const defaultValue =
              creditMap[field.key] ?? fallback;

            return (
              <div
                key={field.key}
                style={{
                  padding: "0.9rem",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.11)",
                }}
              >
                <label
                  className="copy"
                  htmlFor={`credit_${field.key}`}
                  style={{ fontWeight: 800 }}
                >
                  {field.label}
                </label>

                {field.key === "additional_notes" ? (
                  <textarea
                    id={`credit_${field.key}`}
                    name={`credit_${field.key}`}
                    defaultValue={defaultValue}
                    className="textarea"
                    rows={4}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    id={`credit_${field.key}`}
                    name={`credit_${field.key}`}
                    defaultValue={defaultValue}
                    className="input"
                    placeholder={field.placeholder}
                    list={
                      "listId" in field
                        ? field.listId
                        : undefined
                    }
                  />
                )}

                <p
                  className="copy"
                  style={{
                    margin: "0.35rem 0 0",
                    fontSize: "0.82rem",
                    opacity: 0.78,
                  }}
                >
                  {field.help}
                </p>
              </div>
            );
          })}
        </div>

        <datalist id="music-generation-tools">
          <option value="Suno" />
          <option value="Eleven Music" />
          <option value="Udio" />
          <option value="AIVA" />
        </datalist>

        <datalist id="voice-tools">
          <option value="Kits AI" />
          <option value="ElevenLabs" />
        </datalist>

        <datalist id="video-generation-tools">
          <option value="Runway" />
          <option value="Revid" />
          <option value="Sondo" />
          <option value="Veo" />
        </datalist>

        <datalist id="video-editing-tools">
          <option value="Movavi" />
        </datalist>

        <label
          className="copy"
          style={{
            display: "flex",
            gap: "0.65rem",
            alignItems: "center",
            marginTop: "1rem",
            width: "fit-content",
          }}
        >
          <input
            type="checkbox"
            name="credits_are_public"
            defaultChecked={creditsArePublic}
          />
          Show these credits on the public song page
        </label>

        <div
          className="button-row"
          style={{ marginTop: "1rem" }}
        >
          <button type="submit" className="button primary">
            Save Production Credits
          </button>
        </div>
      </form>
    </section>
  );
}
