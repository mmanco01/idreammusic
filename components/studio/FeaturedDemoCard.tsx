import Link from "next/link";

export function FeaturedDemoCard() {
  return (
    <section
      style={{
        marginTop: "24px",
        padding: "24px",
        border: "1px solid rgba(232, 200, 120, 0.35)",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, rgba(232,200,120,0.10), rgba(255,255,255,0.04))",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#e8c878",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Public demonstration
      </p>

      <h2 style={{ margin: "8px 0 10px" }}>
        Explore the complete journey of “Do You Believe?”
      </h2>

      <p style={{ margin: "0 0 18px", maxWidth: "760px", lineHeight: 1.65 }}>
        Follow one real song from its first moment of inspiration through Muse
        classification, AI-assisted development, Song Intelligence, and the
        finished recording.
      </p>

      <Link
        href="/studio/demo/do-you-believe"
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: "42px",
          padding: "0 17px",
          borderRadius: "999px",
          color: "#142039",
          background: "#e8c878",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        Take the Song Journey
      </Link>
    </section>
  );
}
