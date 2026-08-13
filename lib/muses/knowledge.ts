import OpenAI from "openai";
import type {
  MuseKnowledgeCitation,
  MuseKnowledgeCitationRequest,
  MuseKnowledgePromptItem,
} from "@/lib/muses/knowledge-types";

const DEFAULT_EMBEDDING_MODEL =
  "text-embedding-3-small";

const EMBEDDING_DIMENSIONS = 1536;

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(
  value: unknown,
  maxLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

export function knowledgeEmbeddingModel() {
  return (
    process.env.OPENAI_KNOWLEDGE_EMBEDDING_MODEL ||
    DEFAULT_EMBEDDING_MODEL
  );
}

export async function embedKnowledgeTexts({
  openai,
  texts,
}: {
  openai: OpenAI;
  texts: string[];
}) {
  const normalized = texts
    .map((text) =>
      cleanText(text, 30000),
    )
    .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  const response =
    await openai.embeddings.create({
      model: knowledgeEmbeddingModel(),
      input: normalized,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    });

  return [...response.data]
    .sort((a, b) => a.index - b.index)
    .map((item) =>
      Array.from(item.embedding),
    );
}

export async function embedKnowledgeText({
  openai,
  text,
}: {
  openai: OpenAI;
  text: string;
}) {
  const embeddings =
    await embedKnowledgeTexts({
      openai,
      texts: [text],
    });

  const embedding = embeddings[0];

  if (!embedding) {
    throw new Error(
      "The knowledge query could not be embedded.",
    );
  }

  return embedding;
}

function normalizeSearchRow(
  row: any,
  index: number,
): MuseKnowledgePromptItem {
  return {
    citationKey: `K${index + 1}`,
    sourceId: String(row.source_id),
    chunkId: String(row.chunk_id),
    sourceKey: String(row.source_key),
    sourceType: String(row.source_type),
    title: String(row.title),
    authorCreator:
      row.author_creator ?? null,
    editorTranslator:
      row.editor_translator ?? null,
    tradition: row.tradition ?? null,
    historicalPeriod:
      row.historical_period ?? null,
    publicationYear:
      row.publication_year ?? null,
    canonicalUrl:
      row.canonical_url ?? null,
    bibliographicCitation:
      String(row.bibliographic_citation),
    sourceLocator:
      row.source_locator ?? null,
    evidenceClassification:
      String(row.evidence_classification),
    rightsStatus:
      String(row.rights_status),
    verificationStatus:
      String(row.verification_status),
    sourceQuality:
      Number(row.source_quality ?? 0),
    heading: row.heading ?? null,
    content: String(row.content),
    contentOrigin:
      String(row.content_origin),
    citationText:
      String(row.citation_text),
    relevanceScore: clamp(
      Number(row.hybrid_score ?? 0),
      0,
      1,
    ),
  };
}

export async function retrieveMuseKnowledge({
  supabase,
  openai,
  query,
  museSlug,
  ownerUserId,
  songId,
  conversationId,
  queryContext,
  matchCount = 8,
  minimumSimilarity = 0.20,
  sourceTypes,
  traditions,
  agentJobId,
  logSearch = true,
}: {
  supabase: any;
  openai: OpenAI;
  query: string;
  museSlug: string;
  ownerUserId?: string | null;
  songId?: string | null;
  conversationId?: string | null;
  queryContext?: string | null;
  matchCount?: number;
  minimumSimilarity?: number;
  sourceTypes?: string[] | null;
  traditions?: string[] | null;
  agentJobId?: string | null;
  logSearch?: boolean;
}) {
  const cleanQuery = cleanText(
    query,
    12000,
  );

  if (!cleanQuery) {
    return {
      searchId: null,
      results:
        [] as MuseKnowledgePromptItem[],
    };
  }

  const embedding =
    await embedKnowledgeText({
      openai,
      text: cleanQuery,
    });

  const rpcName =
    agentJobId
      ? "search_muse_knowledge_candidate"
      : "search_muse_knowledge";

  const rpcArgs: Record<
    string,
    unknown
  > = {
    p_query_text:
      cleanQuery,

    p_query_embedding:
      embedding,

    p_muse_slug:
      museSlug,

    p_match_count:
      clamp(
        matchCount,
        1,
        20,
      ),

    p_min_similarity:
      clamp(
        minimumSimilarity,
        0,
        1,
      ),

    p_source_types:
      sourceTypes ?? null,

    p_traditions:
      traditions ?? null,
  };

  if (agentJobId) {
    rpcArgs.p_agent_job_id =
      agentJobId;
  }

  const { data, error } =
    await (supabase as any).rpc(
      rpcName,
      rpcArgs,
    );

  if (error) {
    throw new Error(
      `The ${museSlug} knowledge library could not be searched: ${error.message}`,
    );
  }

  const results = (data ?? []).map(
    normalizeSearchRow,
  );

  let searchId: string | null = null;

  if (logSearch && ownerUserId) {
    const { data: searchRow, error: searchError } =
      await (supabase as any)
        .from("muse_knowledge_searches")
        .insert({
          owner_user_id: ownerUserId,
          song_id: songId ?? null,
          conversation_id:
            conversationId ?? null,
          muse_slug: museSlug,
          query_text: cleanQuery,
          query_context:
            cleanText(
              queryContext,
              16000,
            ) || null,
          embedding_model:
            knowledgeEmbeddingModel(),
          filters: {
            sourceTypes:
              sourceTypes ?? null,
            traditions:
              traditions ?? null,
            minimumSimilarity,
            matchCount,
          },
          result_count:
            results.length,
        })
        .select("id")
        .single();

    if (searchError) {
      console.error(
        "Unable to save Muse knowledge search:",
        searchError.message,
      );
    } else {
      searchId =
        searchRow?.id ?? null;
    }
  }

  return {
    searchId,
    results,
  };
}

export function buildSongKnowledgeQuery({
  question,
  context,
}: {
  question: string;
  context: any;
}) {
  const currentLyrics =
    context?.currentVersion?.lyrics;

  const transcript =
    context?.latestTranscript?.text;

  return [
    question,
    context?.song?.title
      ? `Song title: ${context.song.title}`
      : "",
    context?.song?.summary
      ? `Song summary: ${context.song.summary}`
      : "",
    context?.song?.hookLine
      ? `Hook: ${context.song.hookLine}`
      : "",
    currentLyrics
      ? `Current lyric excerpt: ${String(
          currentLyrics,
        ).slice(0, 2800)}`
      : "",
    transcript
      ? `Transcript excerpt: ${String(
          transcript,
        ).slice(0, 1600)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function resolveKnowledgeCitations({
  requests,
  retrieved,
}: {
  requests: MuseKnowledgeCitationRequest[];
  retrieved: MuseKnowledgePromptItem[];
}): MuseKnowledgeCitation[] {
  const byKey = new Map(
    retrieved.map((item) => [
      item.citationKey,
      item,
    ]),
  );

  const seen = new Set<string>();
  const citations: MuseKnowledgeCitation[] = [];

  for (const request of requests) {
    const citationKey =
      cleanText(
        request.citationKey,
        8,
      ).toUpperCase();

    if (
      !citationKey ||
      seen.has(citationKey)
    ) {
      continue;
    }

    const item = byKey.get(citationKey);

    if (!item) {
      continue;
    }

    seen.add(citationKey);

    citations.push({
      citationKey,
      supportedClaim:
        cleanText(
          request.supportedClaim,
          500,
        ),
      sourceId: item.sourceId,
      chunkId: item.chunkId,
      sourceKey: item.sourceKey,
      sourceType: item.sourceType,
      title: item.title,
      authorCreator:
        item.authorCreator,
      editorTranslator:
        item.editorTranslator,
      tradition: item.tradition,
      historicalPeriod:
        item.historicalPeriod,
      publicationYear:
        item.publicationYear,
      canonicalUrl:
        item.canonicalUrl,
      bibliographicCitation:
        item.bibliographicCitation,
      sourceLocator:
        item.sourceLocator,
      evidenceClassification:
        item.evidenceClassification,
      rightsStatus:
        item.rightsStatus,
      verificationStatus:
        item.verificationStatus,
      sourceQuality:
        item.sourceQuality,
      heading: item.heading,
      citationText:
        item.citationText,
      relevanceScore:
        item.relevanceScore,
    });
  }

  return citations;
}

export async function saveMuseKnowledgeCitations({
  supabase,
  citations,
  ownerUserId,
  songId,
  conversationId,
  messageId,
  searchId,
}: {
  supabase: any;
  citations: MuseKnowledgeCitation[];
  ownerUserId: string;
  songId: string;
  conversationId: string;
  messageId: string;
  searchId?: string | null;
}) {
  if (!citations.length) {
    return;
  }

  const rows = citations.map(
    (citation) => ({
      owner_user_id: ownerUserId,
      song_id: songId,
      conversation_id:
        conversationId,
      message_id: messageId,
      search_id: searchId ?? null,
      source_id: citation.sourceId,
      chunk_id: citation.chunkId,
      citation_key:
        citation.citationKey,
      claim_summary:
        citation.supportedClaim,
      relevance_score:
        citation.relevanceScore,
    }),
  );

  const { error } = await (
    supabase as any
  )
    .from(
      "muse_message_knowledge_citations",
    )
    .upsert(rows, {
      onConflict:
        "message_id,citation_key",
    });

  if (error) {
    console.error(
      "Unable to save Muse knowledge citations:",
      error.message,
    );
  }
}

export function hydrateStoredCitation(
  row: any,
): MuseKnowledgeCitation {
  const source =
    row.muse_knowledge_sources ?? {};
  const chunk =
    row.muse_knowledge_chunks ?? {};

  return {
    citationKey:
      String(row.citation_key),
    supportedClaim:
      String(row.claim_summary),
    sourceId:
      String(row.source_id),
    chunkId:
      String(row.chunk_id),
    sourceKey:
      String(source.source_key ?? ""),
    sourceType:
      String(source.source_type ?? ""),
    title:
      String(source.title ?? "Source"),
    authorCreator:
      source.author_creator ?? null,
    editorTranslator:
      source.editor_translator ?? null,
    tradition:
      source.tradition ?? null,
    historicalPeriod:
      source.historical_period ?? null,
    publicationYear:
      source.publication_year ?? null,
    canonicalUrl:
      source.canonical_url ?? null,
    bibliographicCitation:
      String(
        source.bibliographic_citation ??
          "",
      ),
    sourceLocator:
      chunk.source_locator ??
      source.source_locator ??
      null,
    evidenceClassification:
      String(
        source.evidence_classification ??
          "",
      ),
    rightsStatus:
      String(source.rights_status ?? ""),
    verificationStatus:
      String(
        source.verification_status ??
          "",
      ),
    sourceQuality:
      Number(
        source.source_quality ?? 0,
      ),
    heading: chunk.heading ?? null,
    citationText:
      String(
        chunk.citation_text ??
          source.bibliographic_citation ??
          "",
      ),
    relevanceScore:
      Number(row.relevance_score ?? 0),
  };
}

