export type SparkDraftNote = {
  id: string;
  title: string;
  body: string;
};

export type SparkDraftFile = {
  id: string;
  file: File;
  source: "upload" | "recording";
};

export type SparkCaptureDraft = {
  version: 1;
  savedAt: number;
  title: string;
  sparkText: string;
  museSlug: string;
  notes: SparkDraftNote[];
  files: SparkDraftFile[];
};

type StoredDraftState = Omit<SparkCaptureDraft, "files"> & {
  id: "spark-capture";
  fileIds: string[];
};

type StoredDraftFile = {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  source: "upload" | "recording";
  blob: Blob;
};

const DATABASE_NAME = "idreammusic-local-drafts";
const DATABASE_VERSION = 1;
const STATE_STORE = "draft-state";
const FILE_STORE = "draft-files";
const DRAFT_ID = "spark-capture";
const FALLBACK_KEY = "idreammusic:spark-capture-draft:v1";

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        database.createObjectStore(FILE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local draft storage."));
  });
}

function saveFallbackDraft(draft: SparkCaptureDraft) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    FALLBACK_KEY,
    JSON.stringify({
      version: draft.version,
      savedAt: draft.savedAt,
      title: draft.title,
      sparkText: draft.sparkText,
      museSlug: draft.museSlug,
      notes: draft.notes,
    }),
  );
}

function loadFallbackDraft(): SparkCaptureDraft | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(FALLBACK_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Omit<SparkCaptureDraft, "files">;
    return { ...parsed, files: [] };
  } catch {
    window.localStorage.removeItem(FALLBACK_KEY);
    return null;
  }
}

export async function saveSparkCaptureDraft(draft: SparkCaptureDraft) {
  saveFallbackDraft(draft);
  if (!canUseIndexedDb()) return;

  const database = await openDraftDatabase();

  try {
    const transaction = database.transaction(
      [STATE_STORE, FILE_STORE],
      "readwrite",
    );
    const stateStore = transaction.objectStore(STATE_STORE);
    const fileStore = transaction.objectStore(FILE_STORE);
    const fileIds = draft.files.map((item) => item.id);

    stateStore.put({
      id: DRAFT_ID,
      version: draft.version,
      savedAt: draft.savedAt,
      title: draft.title,
      sparkText: draft.sparkText,
      museSlug: draft.museSlug,
      notes: draft.notes,
      fileIds,
    } satisfies StoredDraftState);

    fileStore.clear();

    draft.files.forEach((item) => {
      fileStore.put({
        id: item.id,
        name: item.file.name,
        type: item.file.type,
        lastModified: item.file.lastModified,
        source: item.source,
        blob: item.file,
      } satisfies StoredDraftFile);
    });

    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function loadSparkCaptureDraft(): Promise<SparkCaptureDraft | null> {
  if (!canUseIndexedDb()) return loadFallbackDraft();

  const database = await openDraftDatabase();

  try {
    const stateTransaction = database.transaction(STATE_STORE, "readonly");
    const state = (await requestToPromise(
      stateTransaction.objectStore(STATE_STORE).get(DRAFT_ID),
    )) as StoredDraftState | undefined;

    if (!state) return loadFallbackDraft();

    const fileTransaction = database.transaction(FILE_STORE, "readonly");
    const allStoredFiles = (await requestToPromise(
      fileTransaction.objectStore(FILE_STORE).getAll(),
    )) as StoredDraftFile[];
    const filesById = new Map(
      allStoredFiles.map((stored) => [stored.id, stored] as const),
    );

    const storedFiles = state.fileIds.flatMap((id) => {
      const stored = filesById.get(id);
      if (!stored) return [];

      return [
        {
          id: stored.id,
          source: stored.source,
          file: new File([stored.blob], stored.name, {
            type: stored.type,
            lastModified: stored.lastModified,
          }),
        } satisfies SparkDraftFile,
      ];
    });

    return {
      version: 1,
      savedAt: state.savedAt,
      title: state.title,
      sparkText: state.sparkText,
      museSlug: state.museSlug,
      notes: state.notes,
      files: storedFiles,
    };
  } finally {
    database.close();
  }
}

export async function clearSparkCaptureDraft() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(FALLBACK_KEY);
  }
  if (!canUseIndexedDb()) return;

  const database = await openDraftDatabase();

  try {
    const transaction = database.transaction(
      [STATE_STORE, FILE_STORE],
      "readwrite",
    );
    transaction.objectStore(STATE_STORE).delete(DRAFT_ID);
    transaction.objectStore(FILE_STORE).clear();
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}
