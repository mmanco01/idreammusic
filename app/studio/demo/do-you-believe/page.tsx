import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Do You Believe? — Featured Song Journey | iDreamMusic",
  description:
    "See how one song moves from inspiration through transcription, Song Intelligence, human-led AI collaboration, and audience intelligence.",
};

const journey = [
  {
    step: "01",
    label: "Inspiration",
    title: "Capture the human moment first",
    description:
      "The song began with a dream. The writer recorded the remembered lines and documented the experience before trying to turn it into a finished lyric.",
    image: "/demo/do-you-believe/01-inspiration.png",
    alt: "Writer note describing the dream that inspired Do You Believe",
    takeaway:
      "Songcatcher Studio preserves the source of the song—the memory, dream, phrase, or musical moment that made it worth writing.",
  },
  {
    step: "02",
    label: "Transcription",
    title: "Turn the recording into workable material",
    description:
      "The original recording is selected, transcribed, reviewed, corrected, and saved. The songwriter can keep the raw spoken memory beside the emerging lyric.",
    image: "/demo/do-you-believe/02-transcript.png",
    alt: "Transcript and AI Song Intelligence screen for Do You Believe",
    takeaway:
      "The recording remains the source of truth. AI accelerates transcription, but the songwriter reviews and approves the text.",
  },
  {
    step: "03",
    label: "Song Intelligence",
    title: "Understand the story, hook, Muse, and musical direction",
    description:
      "The engine examines the core theme, emotional arc, hook strength, narrative clarity, Muse alignment, lyric craft, tempo feel, genre fit, vocal guidance, and arrangement possibilities.",
    image: "/demo/do-you-believe/03-song-intelligence-guidance.png",
    alt: "Song Intelligence story, hook, Muse guidance, lyric craft, and musical direction",
    takeaway:
      "Analysis is presented as guidance—not an automatic rewrite. The songwriter decides which insights belong in the work.",
  },
  {
    step: "04",
    label: "Human + AI Development",
    title: "Convert useful guidance into deliberate creative tasks",
    description:
      "The analysis identifies strengths, work needed, rewrite opportunities, and an emotional curve. The songwriter can turn selected recommendations into tasks instead of accepting every suggestion.",
    image: "/demo/do-you-believe/04-ai-collaboration.png",
    alt: "Strengths and work-needed panels with create song task controls",
    takeaway:
      "AI proposes. The human selects, rejects, reshapes, and completes. Authorship stays with the songwriter.",
  },
  {
    step: "05",
    label: "Audience Intelligence",
    title: "Consider how the finished song may connect",
    description:
      "Audience and style intelligence considers likely listeners, playlist fit, radio potential, sync possibilities, and broad stylistic comparisons without asking the writer to imitate another artist.",
    image: "/demo/do-you-believe/05-audience-intelligence.png",
    alt: "Audience and style intelligence for Do You Believe",
    takeaway:
      "The song is evaluated for potential connection only after its human identity and creative direction are understood.",
  },
];

export default function DoYouBelieveDemoPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Featured Songcatcher Studio Demonstration</p>
        <h1>Do You Believe?</h1>
        <p className={styles.lead}>
          Follow one real song from a remembered dream through transcription,
          Song Intelligence, human-led AI development, and audience intelligence.
        </p>

        <div className={styles.heroActions}>
          <a className={styles.primaryButton} href="#journey">
            Begin the journey
          </a>
          <Link className={styles.secondaryButton} href="/studio">
            Return to Songcatcher Studio
          </Link>
        </div>

        <div className={styles.principle}>
          <strong>Inspiration before generation.</strong>
          <span>
            The platform begins with the songwriter&apos;s experience and uses AI
            to help develop it—not replace it.
          </span>
        </div>
      </section>

      <section id="journey" className={styles.journey}>
        {journey.map((item) => (
          <article className={styles.step} key={item.step}>
            <header className={styles.stepHeader}>
              <div className={styles.stepNumber}>{item.step}</div>
              <div>
                <p className={styles.stepLabel}>{item.label}</p>
                <h2>{item.title}</h2>
                <p className={styles.description}>{item.description}</p>
              </div>
            </header>

            <a
              className={styles.imageLink}
              href={item.image}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open full-size image: ${item.alt}`}
            >
              <Image
                className={styles.screenshot}
                src={item.image}
                alt={item.alt}
                width={1400}
                height={1100}
                sizes="(max-width: 900px) 94vw, 1100px"
              />
              <span className={styles.expandLabel}>Open full-size screenshot ↗</span>
            </a>

            <div className={styles.takeaway}>
              <span>What this demonstrates</span>
              <p>{item.takeaway}</p>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.finalSection}>
        <p className={styles.eyebrow}>The complete creative path</p>
        <h2>A working system, not just a concept</h2>
        <p>
          Songcatcher Studio connects the original source, recording, transcript,
          creative analysis, selected development work, and audience potential in
          one traceable song journey. Each screen supports the creator while
          preserving the decisions that keep the work human.
        </p>

        <div className={styles.flow}>
          <span>Inspiration</span>
          <b>→</b>
          <span>Recording</span>
          <b>→</b>
          <span>Transcript</span>
          <b>→</b>
          <span>Song Intelligence</span>
          <b>→</b>
          <span>Human Decisions</span>
          <b>→</b>
          <span>Audience Connection</span>
        </div>

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
