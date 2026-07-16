'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  generateSongTranscript,
  saveSongTranscript,
  type TranscriptGenerateState,
  type TranscriptSaveState,
} from '@/app/studio/songs/[slug]/edit/actions';

type AudioAttachment = {
  id: string;
  title: string | null;
  storage_path: string;
  bucket: string;
  mime_type: string | null;
  song_version_id: string | null;
  created_at: string;
};

type Transcript = {
  id: string;
  attachment_id: string | null;
  song_version_id: string | null;
  transcript_text: string;
  is_reviewed: boolean;
  updated_at: string;
};

type Props = {
  songId: string;
  slug: string;
  audioAttachments: AudioAttachment[];
  transcripts: Transcript[];
};

const initialSaveState: TranscriptSaveState = {
  status: 'idle',
  message: '',
};

const initialGenerateState: TranscriptGenerateState = {
  status: 'idle',
  message: '',
};

function SaveTranscriptButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="button primary"
      disabled={pending}
      style={{ cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}
    >
      {pending ? 'Saving…' : 'Save transcript'}
    </button>
  );
}


function GenerateTranscriptButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="button"
      disabled={pending}
      style={{ cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}
    >
      {pending ? 'Generating…' : 'Generate Transcript'}
    </button>
  );
}

export function SongIntelligencePanel({
  songId,
  slug,
  audioAttachments,
  transcripts,
}: Props) {
  const router = useRouter();
  const [saveState, saveFormAction] = useActionState(saveSongTranscript, initialSaveState);
  const [generateState, generateFormAction] = useActionState(
    generateSongTranscript,
    initialGenerateState
  );
  const [selectedAttachmentId, setSelectedAttachmentId] = useState(
    audioAttachments[0]?.id ?? ''
  );

  const selectedAttachment = useMemo(
    () => audioAttachments.find((item) => item.id === selectedAttachmentId) ?? null,
    [audioAttachments, selectedAttachmentId]
  );

  const selectedTranscript = useMemo(
    () => transcripts.find((item) => item.attachment_id === selectedAttachmentId) ?? null,
    [transcripts, selectedAttachmentId]
  );

  useEffect(() => {
    if (saveState.status === 'success' || generateState.status === 'success') {
      router.refresh();
    }
  }, [router, saveState.status, generateState.status]);

  if (audioAttachments.length === 0) {
    return (
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="eyebrow">Song intelligence</div>
        <h2 className="h2">Transcript &amp; AI Analytics</h2>
        <p className="copy">
          Upload an audio version of this song first. Once a recording exists, it can be
          transcribed, reviewed, and analyzed here.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="eyebrow">Song intelligence</div>
      <h2 className="h2">Transcript &amp; AI Analytics</h2>
      <p className="copy" style={{ maxWidth: 820 }}>
        Choose a recording, save or correct its transcript, then use that transcript for AI
        Analytics. Automated transcription and analytics are the next connection step.
      </p>

      <label className="copy" htmlFor="intelligence-audio">
        Recording
      </label>
      <select
        id="intelligence-audio"
        className="input"
        value={selectedAttachmentId}
        onChange={(event) => setSelectedAttachmentId(event.target.value)}
      >
        {audioAttachments.map((attachment) => (
          <option key={attachment.id} value={attachment.id}>
            {attachment.title || attachment.storage_path.split('/').pop() || 'Audio recording'}
          </option>
        ))}
      </select>

      <div className="pillRow" style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
        <span className="pill">{selectedAttachment?.mime_type || 'audio'}</span>
        {selectedTranscript ? (
          <span className="pill">
            {selectedTranscript.is_reviewed ? 'Transcript reviewed' : 'Transcript saved'}
          </span>
        ) : (
          <span className="pill">No transcript yet</span>
        )}
      </div>

      <form action={saveFormAction} key={`save-${selectedAttachmentId}`}>
        <input type="hidden" name="song_id" value={songId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="attachment_id" value={selectedAttachmentId} />
        <input
          type="hidden"
          name="song_version_id"
          value={selectedAttachment?.song_version_id ?? ''}
        />
        <input type="hidden" name="transcript_id" value={selectedTranscript?.id ?? ''} />

        <label className="copy" htmlFor="transcript_text">
          Full transcript
        </label>
        <textarea
          id="transcript_text"
          name="transcript_text"
          className="textarea"
          rows={14}
          defaultValue={selectedTranscript?.transcript_text ?? ''}
          placeholder="Paste or type the transcript here. Automated transcription will populate this field in the next phase."
        />

        <label
          className="copy"
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}
        >
          <input
            type="checkbox"
            name="is_reviewed"
            defaultChecked={selectedTranscript?.is_reviewed ?? false}
          />
          <span>I reviewed this transcript against the recording.</span>
        </label>

        {saveState.message ? (
          <div
            role="status"
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: 14,
              border: '1px solid var(--line)',
              color: saveState.status === 'error' ? '#ffb4b4' : '#d9f7d6',
              background:
                saveState.status === 'error'
                  ? 'rgba(160, 40, 40, 0.18)'
                  : 'rgba(40, 130, 60, 0.18)',
            }}
          >
            {saveState.message}
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: '1rem' }}>
          <SaveTranscriptButton />
          <button type="button" className="button" disabled title="Requires a saved transcript">
            Run AI Analytics
          </button>
        </div>
      </form>

      <form action={generateFormAction} key={`generate-${selectedAttachmentId}`} style={{ marginTop: '1rem' }}>
        <input type="hidden" name="song_id" value={songId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="attachment_id" value={selectedAttachmentId} />
        <GenerateTranscriptButton />

        {generateState.message ? (
          <div
            role="status"
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: 14,
              border: '1px solid var(--line)',
              color: generateState.status === 'error' ? '#ffb4b4' : '#d9f7d6',
              background:
                generateState.status === 'error'
                  ? 'rgba(160, 40, 40, 0.18)'
                  : 'rgba(40, 130, 60, 0.18)',
            }}
          >
            {generateState.message}
          </div>
        ) : null}
      </form>
    </div>
  );
}
