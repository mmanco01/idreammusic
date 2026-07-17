import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Do You Believe? — Featured Song Journey | iDreamMusic",
  description:
    "Explore how a real song moves from inspiration to final release through the Songcatcher Studio workflow.",
};

const song = {
  title: "Do You Believe?",
  subtitle: "A featured Songcatcher Studio demonstration",
  muse: "Polyhymnia",
  secondaryMuse: "Melpomene",
  stage: "Final",
  genre: "Blues / Roots",
  mood: "Reflective, hopeful",
  tempo: "72 BPM",
  releaseDate: "Add release date",
  plays: 0,
  rating: "Not yet public",
};

const journeySteps = [
  {
    number: "01",
    label: "Inspiration",
    title: "Where it began",
    body:
      "At the close of an outdoor performance, another singer repeated a simple question: “Do you believe?” The line stayed with me. I stepped to the microphone, found a harmony beneath it, and watched another voice join. That real moment became the spark for the song.",
    details: ["Live performance", "A remembered phrase", "Three voices finding a harmony"],
  },
  {
    number: "02",
    label: "Spark",
    title: "Capturing the idea before it disappeared",
    body:
      "The first task was not to finish the song. It was to preserve the feeling—the question, the harmony, and the sense that the night itself had come alive.",
    details: ["Original concept note", "Early lyric fragment", "Voice memo or first recording"],
  },
  {
    number: "03",
    label: "Development",
    title: "Turning a moment into a song",
    body:
      "The song moved through drafts as the story, chorus, and emotional arc became clearer. Each revision aimed to protect the original experience rather than replace it with something more generic.",
    details: ["Draft lyrics", "Structure and chorus refinement", "Now / Next / Later development tasks"],
  },
  {
    number: "04",
    label: "AI Collaboration",
    title: "Assistance without surrendering authorship",
    body:
      "AI helped organize ideas, examine structure, and test alternate lines. The songwriter remained the decision-maker—accepting useful suggestions, rejecting others, and preserving the human source of the song.",
    details: ["Transcription support", "Lyric and structure analysis", "Human approval at every step"],
  },
  {
    number: "05",
    label: "Song Intelligence",
    title: "Understanding what the song is becoming",
    body:
      "Song Intelligence identifies themes, emotional direction, genre signals, Muse alignment, and development opportunities. It helps the songwriter see the work more clearly without dictating what the song must become.",
    details: ["Theme: belief and perseverance", "Primary Muse: Polyhymnia", "Secondary Muse: Melpomene"],
  },
  {
    number: "06",
    label: "Final",
    title: "A finished song with its journey intact",
    body:
      "The final version is more than an audio file. Songcatcher Studio preserves the path from inspiration through revision, allowing listeners, collaborators, and potential partners to understand how the work came to life.",
    details: ["Final lyrics", "Final recording", "Release and engagement information"],
  },
];

const collaboration = [
  {
    who: "Human",
    action: "Recognized the emotional power of a spontaneous live moment.",
  },
  {
    who: "AI",
    action: "Helped organize the story and examine possible song structures.",
  },
  {
    who: "Human",
    action: "Chose to remove “in love” so listeners could answer the question for themselves.",
  },
  {
    who: "AI",
    action: "Suggested alternatives for pacing, repetition, and lyrical clarity.",
  },
  {
    who: "Human",
    action: "Accepted only the ideas that served the original experience and voice.",
  },
];

export default function DoYouBelieveDemoPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>Featured Song Journey</div>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.demoBadge}>Interactive Songcatcher Studio Demonstration</p>
            <h1>{song.title}</h1>
            <p className={styles.subtitle}>
              This page demonstrates how Songcatcher Studio carries one real song
              from its first moment of inspiration through human-led, AI-assisted
              development to a finished work.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#journey">
                Take the Song Journey
              </a>
              <Link className={styles.secondaryButton} href="/studio">
                Return to Studio
              </Link>
            </div>
          </div>

          <aside className={styles.songCard} aria-label="Song summary">
            <div className={styles.coverPlaceholder}>
              <span>Featured Demo</span>
              <strong>{song.title}</strong>
              <small>Add cover artwork here</small>
            </div>
            <dl className={styles.songFacts}>
              <div><dt>Primary Muse</dt><dd>{song.muse}</dd></div>
              <div><dt>Secondary Muse</dt><dd>{song.secondaryMuse}</dd></div>
              <div><dt>Stage</dt><dd>{song.stage}</dd></div>
              <div><dt>Genre</dt><dd>{song.genre}</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className={styles.explainer}>
        <p className={styles.kicker}>Why this page exists</p>
        <h2>See the methodology, not just the finished song.</h2>
        <p>
          Songcatcher Studio is designed to preserve the human source of creativity:
          the memory, question, dream, conversation, riff, or feeling that started the
          work. This demonstration shows how the platform connects that source to every
          later decision.
        </p>
      </section>

      <section id="journey" className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>The complete journey</p>
          <h2>From inspiration to final</h2>
        </div>

        <div className={styles.timeline}>
          {journeySteps.map((step) => (
            <article className={styles.timelineItem} key={step.number}>
              <div className={styles.timelineMarker}>
                <span>{step.number}</span>
              </div>
              <div className={styles.timelineContent}>
                <p className={styles.stepLabel}>{step.label}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <ul>
                  {step.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Human + AI</p>
          <h2>Creative partnership with the songwriter in control</h2>
          <p>
            The goal is not automatic generation. The goal is thoughtful assistance
            that helps a creator understand, develop, and complete an authentic idea.
          </p>
        </div>

        <div className={styles.collaborationGrid}>
          {collaboration.map((item, index) => (
            <div className={styles.collaborationCard} key={`${item.who}-${index}`}>
              <span className={item.who === "Human" ? styles.humanTag : styles.aiTag}>
                {item.who}
              </span>
              <p>{item.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Song Intelligence</p>
          <h2>A clearer view of the developing work</h2>
        </div>

        <div className={styles.intelligenceGrid}>
          <article><span>Theme</span><strong>Belief, hope, perseverance</strong></article>
          <article><span>Emotional arc</span><strong>Observation → participation → renewal</strong></article>
          <article><span>Primary Muse</span><strong>{song.muse}</strong></article>
          <article><span>Secondary Muse</span><strong>{song.secondaryMuse}</strong></article>
          <article><span>Genre</span><strong>{song.genre}</strong></article>
          <article><span>Mood</span><strong>{song.mood}</strong></article>
          <article><span>Tempo</span><strong>{song.tempo}</strong></article>
          <article><span>Development stage</span><strong>{song.stage}</strong></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Final song</p>
          <h2>Hear the destination</h2>
          <p>
            Replace the placeholder below with the public audio URL already used by
            your song record, or connect this section directly to Supabase.
          </p>
        </div>

        <div className={styles.playerCard}>
          <div>
            <p className={styles.playerLabel}>Final recording</p>
            <h3>{song.title}</h3>
            <p>{song.genre} · {song.muse} · {song.stage}</p>
          </div>
          <audio controls preload="metadata" className={styles.audioPlayer}>
            {/* Replace with your real public audio URL */}
            <source src="/audio/do-you-believe.mp3" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Engagement</p>
          <h2>How the song connects after completion</h2>
        </div>

        <div className={styles.engagementGrid}>
          <div><span>Plays</span><strong>{song.plays}</strong><small>Connect to listener events</small></div>
          <div><span>Human rating</span><strong>{song.rating}</strong><small>Enable when public ratings are ready</small></div>
          <div><span>Release date</span><strong>{song.releaseDate}</strong><small>Connect to the song record</small></div>
        </div>
      </section>

      <section className={styles.finalCallout}>
        <p className={styles.kicker}>Every song has a journey</p>
        <h2>Songcatcher Studio preserves the path—not only the product.</h2>
        <p>
          Inspiration is captured. Ideas are developed. AI provides thoughtful
          assistance. The songwriter remains the author. Every revision stays
          connected to the human moment that made the song worth writing.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href="/studio">
            Explore Songcatcher Studio
          </Link>
          <Link className={styles.secondaryButton} href="/contact">
            Discuss iDreamMusic
          </Link>
        </div>
      </section>
    </main>
  );
}
