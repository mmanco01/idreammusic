# Expanded Spark Capture deployment

This patch is built against the current GitHub snapshot supplied on July 29, 2026.
Authentication behavior is intentionally unchanged.

## Included

- Text-only Sparks
- Direct microphone recording
- Multiple recordings and files
- MP3, WAV, M4A, AAC, FLAC, WEBM, OGG, PDF, DOC, DOCX, TXT, and RTF
- Multiple private notes
- Configurable and visible upload limits
- Upload progress and useful oversize errors
- Private-by-default new capture and legacy uploads
- Start Over before save
- Soft-delete Spark/Song with Move to Trash
- Captured-materials display in the Song Workbench

## Deployment order

### 1. Run the database migration first

In Supabase SQL Editor, run:

`supabase/migrations/20260729_expand_spark_capture.sql`

The migration is additive and idempotent. It adds `songs.deleted_at` and
`songs.deleted_by`, creates active/trash indexes, raises the `song-assets`
bucket limit to at least 50 MB, and tightens write policies to the user's own
storage path.

### 2. Add Vercel environment variables

In Vercel Project Settings -> Environment Variables, add:

```text
NEXT_PUBLIC_SPARK_AUDIO_MAX_MB=50
NEXT_PUBLIC_SPARK_DOCUMENT_MAX_MB=25
```

The code defaults to the same values if the variables are absent. The app-side
limit must not exceed the effective Supabase project and bucket limit.

### 3. Commit and push the code

```bat
git status
git add .
git commit -m "Expand Spark Capture"
git push -u origin feature/expand-spark-capture
```

Create a pull request into `main`, let Vercel build the preview, and test before
merging.

## Acceptance test

1. Sign in and open `/studio/capture`.
2. Save a title-only Spark.
3. Save a text-only Spark with no audio and no Muse.
4. Record from a phone microphone; pause, resume, stop, and play it back.
5. Add a second recording.
6. Add MP3, PDF, DOCX, and TXT files to one Spark.
7. Confirm the page states 50 MB audio and 25 MB document limits.
8. Try an oversize file and confirm the error names the file, actual size, and maximum.
9. Add two notes.
10. Choose Start Over, cancel once, then confirm it clears the form.
11. Save and confirm all recordings, documents, and notes appear in the workbench.
12. Confirm the new Spark is private by default.
13. Move the Spark to Trash and confirm it disappears from Studio.
14. Re-test `/studio/capture?song=<song-id>&stage=draft` to confirm add-version still works.

## Build validation note

The changed TypeScript/TSX files passed syntax transpilation. A full `npm ci` /
Next build could not run in the artifact workspace because its internal npm
mirror returned 404 for the repository's existing `ws@8.20.0` dependency.
Vercel's preview build should be treated as the authoritative integration build.
