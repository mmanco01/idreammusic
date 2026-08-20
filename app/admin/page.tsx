import Link from "next/link";

import { getServerAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const managerTools = [
  {
    title: "Review Center",
    eyebrow: "Agent releases",
    description:
      "Review Agent research, curation, staged Muse knowledge, validation, human approval, and production releases.",
    href: "/admin/review",
    action: "Open Review Center",
  },
  {
    title: "AI Metrics",
    eyebrow: "Cost & usage",
    description:
      "See OpenAI usage, token volume, estimated cost, expensive calls, Muse spend, and Agent research activity.",
    href: "/admin/metrics",
    action: "Open AI Metrics",
  },
  {
    title: "Agent History",
    eyebrow: "Release record",
    description:
      "Review completed, released, blocked, and historical Agent jobs without mixing them into the active queue.",
    href: "/admin/review?view=history",
    action: "Open Agent History",
  },
  {
    title: "Community Queue",
    eyebrow: "Moderation",
    description:
      "Review community publishing items and keep community moderation separate from Agent release governance.",
    href: "/admin/review?view=community",
    action: "Open Community Queue",
  },
] as const;

const museLibraries = [
  ["Calliope", "Story", "/studio/muses/calliope/library"],
  ["Clio", "Roots", "/studio/muses/clio/library"],
  ["Erato", "Love", "/studio/muses/erato/library"],
  ["Euterpe", "Craft", "/studio/muses/euterpe/library"],
  ["Melpomene", "Blues", "/studio/muses/melpomene/library"],
  ["Polyhymnia", "Faith", "/studio/muses/polyhymnia/library"],
  ["Terpsichore", "Rhythm", "/studio/muses/terpsichore/library"],
  ["Thalia", "Play", "/studio/muses/thalia/library"],
  ["Urania", "Dream", "/studio/muses/urania/library"],
] as const;

const siteShortcuts = [
  ["Studio", "/studio"],
  ["Songs", "/songs"],
  ["Listen", "/listen"],
  ["Nine Muses", "/nine-muses"],
  ["Book", "/book"],
] as const;

function AccessCard({
  signedOut,
}: {
  signedOut: boolean;
}) {
  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="card">
          <div className="eyebrow">Manager</div>
          <h1 className="h2">iDreamMusic Manager</h1>
          <p className="copy">
            {signedOut
              ? "Sign in with an authorized owner or manager account to open the iDreamMusic control room."
              : "This page is reserved for iDreamMusic owner and manager accounts."}
          </p>
          {signedOut ? (
            <Link
              className="button primary"
              href="/auth/sign-in?next=/admin"
            >
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function AdminHomePage() {
  const { user, profile } =
    await getServerAuthContext();

  if (!user) {
    return <AccessCard signedOut />;
  }

  const canManage =
    profile?.role === "owner" ||
    profile?.role === "manager";

  if (!canManage) {
    return <AccessCard signedOut={false} />;
  }

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              Private control room
            </div>
            <h1 className="h2">
              iDreamMusic Manager
            </h1>
            <p
              className="copy"
              style={{ maxWidth: 860 }}
            >
              One place for Agent governance,
              AI operating costs, Muse knowledge,
              community review, and quick access
              to the working parts of iDreamMusic.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "1rem",
          }}
        >
          {managerTools.map((tool) => (
            <div
              className="card"
              key={tool.href}
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 220,
              }}
            >
              <div className="eyebrow">
                {tool.eyebrow}
              </div>
              <h2
                className="h3"
                style={{ marginBottom: ".45rem" }}
              >
                {tool.title}
              </h2>
              <p
                className="copy"
                style={{
                  marginTop: 0,
                  flex: 1,
                }}
              >
                {tool.description}
              </p>
              <div className="button-row">
                <Link
                  className="button primary"
                  href={tool.href}
                >
                  {tool.action}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="eyebrow">
            Muse intelligence
          </div>
          <h2 className="h3">
            Knowledge Libraries
          </h2>
          <p
            className="copy"
            style={{
              maxWidth: 820,
              marginTop: ".35rem",
            }}
          >
            Jump directly into each Muse&apos;s
            knowledge library. Agent validation
            and release controls remain in Review
            Center.
          </p>
          <div
            className="button-row"
            style={{
              marginTop: "1rem",
              gap: ".55rem",
              flexWrap: "wrap",
            }}
          >
            {museLibraries.map(
              ([name, modality, href]) => (
                <Link
                  key={href}
                  className="button"
                  href={href}
                  title={`${name} - ${modality}`}
                >
                  {name}
                </Link>
              ),
            )}
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">
            Site shortcuts
          </div>
          <h2 className="h3">
            Working areas
          </h2>
          <p
            className="copy"
            style={{
              maxWidth: 820,
              marginTop: ".35rem",
            }}
          >
            Fast links back into the main
            songwriter and publishing experience.
          </p>
          <div
            className="button-row"
            style={{
              marginTop: "1rem",
              gap: ".55rem",
              flexWrap: "wrap",
            }}
          >
            {siteShortcuts.map(
              ([label, href]) => (
                <Link
                  key={href}
                  className="button"
                  href={href}
                >
                  {label}
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
