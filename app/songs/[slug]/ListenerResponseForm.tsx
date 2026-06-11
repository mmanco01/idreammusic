'use client';

import { submitSongResponse } from './actions';

export default function ListenerResponseForm({ songId }: { songId: string }) {
  return (
    <form action={submitSongResponse}>
      <input type="hidden" name="song_id" value={songId} />

      <div style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <label htmlFor="title" className="copy" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Optional title"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="author_name" className="copy" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Your name
          </label>
          <input
            id="author_name"
            name="author_name"
            type="text"
            placeholder="Optional"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="excerpt" className="copy" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Your response
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={6}
            placeholder="Share what this song stirred in you..."
            className="textarea"
            required
          />
        </div>

        <div className="button-row">
          <button type="submit" className="button primary">
            Submit for review
          </button>
        </div>
      </div>
    </form>
  );
}