"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  MuseKnowledgePromptItem,
} from "@/lib/muses/knowledge-types";

type SourceSummary = {
  id: string;
  source_key: string;
  source_type: string;
  title: string;
  author_creator: string | null;
  editor_translator: string | null;
  tradition: string | null;
  historical_period: string | null;
  publication_year: number | null;
  publisher: string | null;
  canonical_url: string | null;
  bibliographic_citation: string;
  source_locator: string | null;
  evidence_classification: string;
  rights_status: string;
  rights_note: string | null;
  verification_status: string;
  source_quality: number;
  provenance_notes: string | null;
  curation_notes: string | null;
  document_count: number;
  chunk_count: number;
  embedded_chunk_count: number;
};

type LibraryPayload = {
  status?: string;
  message?: string;
  stats?: {
    sourceCount: number;
    documentCount: number;
    chunkCount: number;
    embeddedChunkCount: number;
    pendingEmbeddingCount: number;
  };
  sources?: SourceSummary[];
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function MuseKnowledgeLibrary({
  museSlug = "polyhymnia",
  museName = "Polyhymnia",
  defaultQuery = "How can a faith song preserve doubt without weakening hope?",
}: {
  museSlug?: string;
  museName?: string;
  defaultQuery?: string;
}) {
  const [library, setLibrary] =
    useState<LibraryPayload | null>(null);
  const [status, setStatus] =
    useState<
      "loading" | "idle" | "error"
    >("loading");
  const [error, setError] =
    useState("");

  const [query, setQuery] =
    useState(defaultQuery);
  const [searchStatus, setSearchStatus] =
    useState<
      "idle" | "searching" | "error"
    >("idle");
  const [results, setResults] =
    useState<MuseKnowledgePromptItem[]>([]);
  const [searchError, setSearchError] =
    useState("");

  const [reindexStatus, setReindexStatus] =
    useState<
      "idle" | "working" | "error"
    >("idle");
  const [reindexMessage, setReindexMessage] =
    useState("");

  const [showAddSource, setShowAddSource] =
    useState(false);
  const [ingestStatus, setIngestStatus] =
    useState<
      "idle" | "saving" | "error"
    >("idle");
  const [ingestMessage, setIngestMessage] =
    useState("");

  const [sourceTitle, setSourceTitle] =
    useState("");
  const [sourceAuthor, setSourceAuthor] =
    useState("");
  const [sourceTradition, setSourceTradition] =
    useState("");
  const [sourceCitation, setSourceCitation] =
    useState("");
  const [sourceUrl, setSourceUrl] =
    useState("");
  const [sourceText, setSourceText] =
    useState("");

  const sourceGroups = useMemo(() => {
    const groups = new Map<
      string,
      SourceSummary[]
    >();

    for (const source of library?.sources ?? []) {
      const current =
        groups.get(source.source_type) ?? [];
      current.push(source);
      groups.set(
        source.source_type,
        current,
      );
    }

    return [...groups.entries()];
  }, [library?.sources]);

  async function loadLibrary() {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(
        `/api/muses/knowledge/library?museSlug=${encodeURIComponent(museSlug)}`,
        {
          cache: "no-store",
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | LibraryPayload
          | null;

      if (
        !response.ok ||
        payload?.status !== "success"
      ) {
        throw new Error(
          payload?.message ||
            "The knowledge library could not be loaded.",
        );
      }

      setLibrary(payload);
      setStatus("idle");
    } catch (loadError) {
      setStatus("error");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The knowledge library could not be loaded.",
      );
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  async function searchLibrary(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    setSearchStatus("searching");
    setSearchError("");

    try {
      const response = await fetch(
        "/api/muses/knowledge/search",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            query,
            museSlug,
            limit: 10,
          }),
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | {
              status?: string;
              message?: string;
              results?: MuseKnowledgePromptItem[];
            }
          | null;

      if (
        !response.ok ||
        payload?.status !== "success"
      ) {
        throw new Error(
          payload?.message ||
            "The knowledge search failed.",
        );
      }

      setResults(
        payload.results ?? [],
      );
      setSearchStatus("idle");
    } catch (searchFailure) {
      setSearchStatus("error");
      setSearchError(
        searchFailure instanceof Error
          ? searchFailure.message
          : "The knowledge search failed.",
      );
    }
  }

  async function embedPending() {
    setReindexStatus("working");
    setReindexMessage("");

    try {
      const response = await fetch(
        "/api/muses/knowledge/reindex",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            museSlug,
            batchSize: 40,
          }),
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | {
              status?: string;
              message?: string;
              processed?: number;
              failed?: number;
            }
          | null;

      if (
        !response.ok ||
        payload?.status !== "success"
      ) {
        throw new Error(
          payload?.message ||
            "Knowledge embedding failed.",
        );
      }

      setReindexMessage(
        payload.message ||
          `Embedded ${payload.processed ?? 0} knowledge chunks${
            payload.failed
              ? `; ${payload.failed} failed`
              : ""
          }.`,
      );
      setReindexStatus("idle");
      await loadLibrary();
    } catch (reindexError) {
      setReindexStatus("error");
      setReindexMessage(
        reindexError instanceof Error
          ? reindexError.message
          : "Knowledge embedding failed.",
      );
    }
  }

  async function addPersonalSource(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (
      !sourceTitle.trim() ||
      !sourceText.trim()
    ) {
      setIngestStatus("error");
      setIngestMessage(
        "A title and source text are required.",
      );
      return;
    }

    setIngestStatus("saving");
    setIngestMessage("");

    try {
      const response = await fetch(
        "/api/muses/knowledge/ingest",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: sourceTitle,
            authorCreator:
              sourceAuthor,
            tradition:
              sourceTradition,
            bibliographicCitation:
              sourceCitation,
            canonicalUrl: sourceUrl,
            text: sourceText,
            scope: "personal",
            museSlug,
            sourceType:
              "personal_archive",
            evidenceClassification:
              "personal_source",
            rightsStatus:
              "user_owned",
          }),
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as
          | {
              status?: string;
              message?: string;
              chunkCount?: number;
            }
          | null;

      if (
        !response.ok ||
        payload?.status !== "success"
      ) {
        throw new Error(
          payload?.message ||
            "The personal source could not be added.",
        );
      }

      setIngestMessage(
        `Added and embedded ${payload.chunkCount ?? 0} private knowledge chunks.`,
      );
      setIngestStatus("idle");
      setSourceTitle("");
      setSourceAuthor("");
      setSourceTradition("");
      setSourceCitation("");
      setSourceUrl("");
      setSourceText("");
      await loadLibrary();
    } catch (ingestError) {
      setIngestStatus("error");
      setIngestMessage(
        ingestError instanceof Error
          ? ingestError.message
          : "The personal source could not be added.",
      );
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
      }}
    >
      <section className="card">
        <div className="eyebrow">
          {museName} Knowledge Library
        </div>

        <h1
          className="h1"
          style={{
            marginBottom: "0.45rem",
          }}
        >
          Knowledge Library
        </h1>

        <p
          className="eyebrow"
          style={{
            marginBottom: "0.65rem",
          }}
        >
          Semantic Search • Citations • Provenance
        </p>

        <p
          className="copy"
          style={{ maxWidth: 920 }}
        >
          This library preserves the provenance of every
          knowledge source by keeping historical evidence,
          editorial frameworks, and private materials
          visibly separate. The active Muse retrieves only
          the most relevant approved knowledge and must cite
          the source keys for every knowledge chunk used
          during analysis.
        </p>

        {status === "loading" ? (
          <p className="copy">
            Loading the library…
          </p>
        ) : status === "error" ? (
          <div
            className="statusMessage statusError"
            role="alert"
          >
            {error}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.65rem",
              marginTop: "0.9rem",
            }}
          >
            {[
              [
                "Sources",
                library?.stats?.sourceCount ?? 0,
              ],
              [
                "Documents",
                library?.stats?.documentCount ?? 0,
              ],
              [
                "Chunks",
                library?.stats?.chunkCount ?? 0,
              ],
              [
                "Embedded",
                library?.stats
                  ?.embeddedChunkCount ?? 0,
              ],
              [
                "Pending",
                library?.stats
                  ?.pendingEmbeddingCount ?? 0,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  padding: "0.8rem",
                  border:
                    "1px solid var(--line)",
                  borderRadius: 14,
                }}
              >
                <div className="eyebrow">
                  {label}
                </div>
                <div
                  className="h2"
                  style={{
                    marginTop: "0.2rem",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="button-row"
          style={{ marginTop: "0.85rem" }}
        >
          <button
            type="button"
            className="button primary"
            disabled={
              reindexStatus === "working"
            }
            onClick={() =>
              void embedPending()
            }
          >
            {reindexStatus === "working"
              ? "Embedding knowledge…"
              : "Embed pending knowledge"}
          </button>

          <button
            type="button"
            className="button"
            onClick={() =>
              setShowAddSource(
                (current) => !current,
              )
            }
          >
            {showAddSource
              ? "Close source form"
              : "Add private source"}
          </button>
        </div>

        {reindexMessage ? (
          <div
            className={`statusMessage ${
              reindexStatus === "error"
                ? "statusError"
                : ""
            }`}
            style={{ marginTop: "0.7rem" }}
          >
            {reindexMessage}
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="eyebrow">
          Search the curated library
        </div>

        <form
          onSubmit={searchLibrary}
          style={{ marginTop: "0.6rem" }}
        >
          <textarea
            className="textarea"
            rows={4}
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />

          <div
            className="button-row"
            style={{ marginTop: "0.65rem" }}
          >
            <button
              type="submit"
              className="button primary"
              disabled={
                searchStatus ===
                "searching"
              }
            >
              {searchStatus ===
              "searching"
                ? "Searching…"
                : "Search by meaning"}
            </button>
          </div>
        </form>

        {searchError ? (
          <div
            className="statusMessage statusError"
            role="alert"
            style={{ marginTop: "0.75rem" }}
          >
            {searchError}
          </div>
        ) : null}

        {results.length ? (
          <div
            style={{
              display: "grid",
              gap: "0.7rem",
              marginTop: "0.85rem",
            }}
          >
            {results.map((result) => (
              <article
                key={result.chunkId}
                style={{
                  padding: "0.85rem",
                  border:
                    "1px solid var(--line)",
                  borderRadius: 15,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.45rem",
                  }}
                >
                  <span className="pill">
                    {result.citationKey}
                  </span>
                  <span className="pill">
                    {percent(
                      result.relevanceScore,
                    )} match
                  </span>
                  <span className="pill">
                    {titleCase(
                      result.evidenceClassification,
                    )}
                  </span>
                  <span className="pill">
                    {titleCase(
                      result.rightsStatus,
                    )}
                  </span>
                </div>

                <h3
                  className="h3"
                  style={{
                    margin:
                      "0.55rem 0 0",
                  }}
                >
                  {result.title}
                </h3>

                <p
                  className="copy"
                  style={{
                    margin:
                      "0.25rem 0 0",
                    opacity: 0.78,
                  }}
                >
                  {[
                    result.authorCreator,
                    result.tradition,
                    result.historicalPeriod,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {result.heading ? (
                  <div
                    className="eyebrow"
                    style={{
                      marginTop: "0.6rem",
                    }}
                  >
                    {result.heading}
                  </div>
                ) : null}

                <p
                  className="copy"
                  style={{
                    margin:
                      "0.35rem 0 0",
                    lineHeight: 1.65,
                  }}
                >
                  {result.content}
                </p>

                <p
                  className="copy"
                  style={{
                    margin:
                      "0.5rem 0 0",
                    fontSize: "0.82rem",
                    opacity: 0.75,
                  }}
                >
                  {result.citationText}
                </p>

                {result.canonicalUrl ? (
                  <a
                    className="button"
                    href={result.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display:
                        "inline-flex",
                      marginTop: "0.55rem",
                    }}
                  >
                    Open source
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {showAddSource ? (
        <section className="card">
          <div className="eyebrow">
            Private songwriter source
          </div>

          <h2 className="h2">
            Add your own faith-writing material
          </h2>

          <p className="copy">
            This is stored as private, user-owned
            source material. Polyhymnia can retrieve
            it later while keeping it distinct from
            ancient, historical, and editorial
            sources.
          </p>

          <form
            onSubmit={addPersonalSource}
            style={{
              display: "grid",
              gap: "0.7rem",
              marginTop: "0.8rem",
            }}
          >
            <input
              className="input"
              placeholder="Source title"
              value={sourceTitle}
              onChange={(event) =>
                setSourceTitle(
                  event.target.value,
                )
              }
            />

            <input
              className="input"
              placeholder="Author or creator"
              value={sourceAuthor}
              onChange={(event) =>
                setSourceAuthor(
                  event.target.value,
                )
              }
            />

            <input
              className="input"
              placeholder="Tradition or context"
              value={sourceTradition}
              onChange={(event) =>
                setSourceTradition(
                  event.target.value,
                )
              }
            />

            <input
              className="input"
              placeholder="Bibliographic citation"
              value={sourceCitation}
              onChange={(event) =>
                setSourceCitation(
                  event.target.value,
                )
              }
            />

            <input
              className="input"
              placeholder="Canonical URL, when available"
              value={sourceUrl}
              onChange={(event) =>
                setSourceUrl(
                  event.target.value,
                )
              }
            />

            <textarea
              className="textarea"
              rows={12}
              placeholder="Paste the personal writing, journal entry, prayer, testimony notes, song commentary, or other source text."
              value={sourceText}
              onChange={(event) =>
                setSourceText(
                  event.target.value,
                )
              }
            />

            <div className="button-row">
              <button
                type="submit"
                className="button primary"
                disabled={
                  ingestStatus === "saving"
                }
              >
                {ingestStatus === "saving"
                  ? "Adding source…"
                  : "Add private source"}
              </button>
            </div>
          </form>

          {ingestMessage ? (
            <div
              className={`statusMessage ${
                ingestStatus === "error"
                  ? "statusError"
                  : ""
              }`}
              style={{ marginTop: "0.7rem" }}
            >
              {ingestMessage}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <div className="eyebrow">
          Source catalog
        </div>

        {sourceGroups.map(
          ([sourceType, sources]) => (
            <details
              key={sourceType}
              open
              style={{
                marginTop: "0.75rem",
              }}
            >
              <summary
                className="copy"
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {titleCase(sourceType)} ·{" "}
                {sources.length}
              </summary>

              <div
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  marginTop: "0.65rem",
                }}
              >
                {sources.map((source) => (
                  <article
                    key={source.id}
                    style={{
                      padding: "0.8rem",
                      border:
                        "1px solid var(--line)",
                      borderRadius: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                      }}
                    >
                      <span className="pill">
                        {titleCase(
                          source.evidence_classification,
                        )}
                      </span>
                      <span className="pill">
                        {titleCase(
                          source.rights_status,
                        )}
                      </span>
                      <span className="pill">
                        Quality{" "}
                        {source.source_quality}/5
                      </span>
                      <span className="pill">
                        {
                          source.embedded_chunk_count
                        }
                        /{source.chunk_count} embedded
                      </span>
                    </div>

                    <h3
                      className="h3"
                      style={{
                        margin:
                          "0.5rem 0 0",
                      }}
                    >
                      {source.title}
                    </h3>

                    <p
                      className="copy"
                      style={{
                        margin:
                          "0.2rem 0 0",
                        opacity: 0.78,
                      }}
                    >
                      {[
                        source.author_creator,
                        source.tradition,
                        source.historical_period,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    <p
                      className="copy"
                      style={{
                        margin:
                          "0.45rem 0 0",
                      }}
                    >
                      {
                        source.bibliographic_citation
                      }
                    </p>

                    {source.provenance_notes ? (
                      <p
                        className="copy"
                        style={{
                          margin:
                            "0.35rem 0 0",
                          fontSize:
                            "0.84rem",
                          opacity: 0.76,
                        }}
                      >
                        <strong>
                          Provenance:
                        </strong>{" "}
                        {
                          source.provenance_notes
                        }
                      </p>
                    ) : null}

                    {source.curation_notes ? (
                      <p
                        className="copy"
                        style={{
                          margin:
                            "0.3rem 0 0",
                          fontSize:
                            "0.84rem",
                          opacity: 0.76,
                        }}
                      >
                        <strong>
                          Curator note:
                        </strong>{" "}
                        {
                          source.curation_notes
                        }
                      </p>
                    ) : null}

                    {source.canonical_url ? (
                      <a
                        className="button"
                        href={
                          source.canonical_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display:
                            "inline-flex",
                          marginTop:
                            "0.55rem",
                        }}
                      >
                        Open source
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </details>
          ),
        )}
      </section>
    </div>
  );
}

// Backwards-compatible named export while existing pages are migrated.
export const PolyhymniaKnowledgeLibrary =
  MuseKnowledgeLibrary;

export default MuseKnowledgeLibrary;
