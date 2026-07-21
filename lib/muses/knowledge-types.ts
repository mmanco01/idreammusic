export type MuseKnowledgeRetrievalMetrics = {
  requestedCount: number;
  retrievedCount: number;
  citedCount: number;
  averageRelevance: number | null;
  highestRelevance: number | null;
  searchId: string | null;
};

export type MuseKnowledgeCitationRequest = {
  citationKey: string;
  supportedClaim: string;
};

export type MuseKnowledgeCitation = {
  citationKey: string;
  supportedClaim: string;
  sourceId: string;
  chunkId: string;
  sourceKey: string;
  sourceType: string;
  title: string;
  authorCreator: string | null;
  editorTranslator: string | null;
  tradition: string | null;
  historicalPeriod: string | null;
  publicationYear: number | null;
  canonicalUrl: string | null;
  bibliographicCitation: string;
  sourceLocator: string | null;
  evidenceClassification: string;
  rightsStatus: string;
  verificationStatus: string;
  sourceQuality: number;
  heading: string | null;
  citationText: string;
  relevanceScore: number;
};

export type MuseKnowledgePromptItem = {
  citationKey: string;
  sourceId: string;
  chunkId: string;
  sourceKey: string;
  sourceType: string;
  title: string;
  authorCreator: string | null;
  editorTranslator: string | null;
  tradition: string | null;
  historicalPeriod: string | null;
  publicationYear: number | null;
  canonicalUrl: string | null;
  bibliographicCitation: string;
  sourceLocator: string | null;
  evidenceClassification: string;
  rightsStatus: string;
  verificationStatus: string;
  sourceQuality: number;
  heading: string | null;
  content: string;
  contentOrigin: string;
  citationText: string;
  relevanceScore: number;
};

export type MuseKnowledgeSearchResponse = {
  status: "success" | "error";
  message?: string;
  searchId?: string | null;
  results?: MuseKnowledgePromptItem[];
};
