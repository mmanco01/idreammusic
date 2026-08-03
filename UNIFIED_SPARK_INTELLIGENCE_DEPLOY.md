# Unified Spark Capture + Text-First Song Intelligence

## What this release changes

This release completes the first authenticated activation loop:

`Any new-Spark entry → /studio/capture → Save My Spark → Your Spark is safe → Run Song Intelligence → Explore with the recommended Muse`

### 1. One new-Spark creation path

- All existing new-song links already point to `/studio/capture`.
- `SparkCaptureForm` now calls one authenticated server endpoint: `POST /api/studio/sparks`.
- The endpoint uses `lib/studio/create-spark.ts` to create the private song, Spark stage, Version 1, and writer notes.
- `SongUploadForm` is now existing-song-only. Its alternate master-song creation branch was removed, so it remains strictly the version uploader.

### 2. One post-save continuation

After any Spark capture saves successfully, the user now sees a focused handoff instead of the full workbench:

- **Your Spark is safe**
- **Run Song Intelligence** as the primary next action
- Add more words or notes
- Return to Studio
- Open the full Song Workbench
- Muse direction remains pending when the songwriter did not preselect a Muse

The full workbench is available deliberately through `?workspace=open`.

### 3. Text-first Song Intelligence

`POST /api/song-analytics/generate` now requires `song_id`; `transcript_id` is optional.

The source resolver can use:

- working/final title
- captured words or saved lyrics
- song summary and hook
- story and meaningful arrangement notes
- writer notes
- the latest or requested transcript
- attachment metadata

Audio is optional. When a new Spark contains audio and no transcript, the guided handoff first attempts transcription and then runs Song Intelligence. If transcription fails but meaningful saved text or document context exists, analysis continues from that material. An automatically generated “Untitled Spark” label is not treated as creative evidence.

Uploaded PDF/Word/text/RTF files remain attached as supporting material. This release includes their filename/type context, but it does **not** claim full document-body extraction.

### 4. Intelligence-to-Muse handoff

New analysis results save:

- analysis stage
- source types
- material completeness
- recommended next move
- lead Muse
- lead-Muse reason
- starter question

The result screen shows the recommended creative partner. **Explore this with [Muse]** opens the Creative Council, selects that Muse, and prefills the saved starter question without sending it automatically.

## Database migration

Apply this migration before deploying the application code:

```text
supabase/migrations/20260802_text_first_song_intelligence.sql
```

It makes `public.ai_analysis_runs.transcript_id` nullable so text-only analyses can be saved.

### Supabase CLI

```bash
supabase db push
```

Or paste the migration into the Supabase SQL Editor and run it once.

## Install the code

From a clean branch based on current `main`:

```bash
git switch -c feature/unified-spark-intelligence
git -c core.whitespace=cr-at-eol apply --check unified-spark-intelligence.patch
git -c core.whitespace=cr-at-eol apply unified-spark-intelligence.patch
```

The `cr-at-eol` setting tells Git that the repository’s existing Windows CRLF line endings are intentional.

Then run:

```bash
npm install
npm run typecheck
npm run build
```

## Manual acceptance test

### Text-only Spark

1. Open `/studio/capture`.
2. Enter only a title and one or two lines.
3. Save.
4. Confirm that only the focused **Your Spark is safe** handoff appears.
5. Run Song Intelligence.
6. Confirm provisional ratings, a recommended next move, lead Muse, and starter question.
7. Click **Explore this with [Muse]**.
8. Confirm the correct Muse is selected and the question is prefilled but unsent.

### Title-only Spark

1. Save a Spark with a title only.
2. Run Song Intelligence.
3. Confirm it runs with limited-material language and does not require audio.

### Audio-only Spark

1. Record or upload audio with no typed words.
2. Save and run Song Intelligence.
3. Confirm transcription runs first, then analysis opens.

### Mixed Spark

1. Add title, typed words, notes, and audio.
2. Save and run Song Intelligence.
3. Confirm the analysis includes mixed source types.

### Existing-song version

1. Open an existing public/private song.
2. Choose Add Draft or Add Final Version.
3. Confirm `SongUploadForm` adds a version to that song and does not create another master song.

### Privacy and mobile

- New Sparks remain `private`.
- The post-save primary button is above the fold on mobile.
- The full workbench appears only after an explicit action or after analysis completes.

## Files changed

- `app/api/song-analytics/generate/route.ts`
- `app/api/studio/sparks/route.ts`
- `app/studio/songs/[slug]/edit/page.tsx`
- `components/studio/MuseChatPanel.tsx`
- `components/studio/SongIntelligencePanel.tsx`
- `components/studio/SongUploadForm.tsx`
- `components/studio/SparkCaptureForm.tsx`
- `components/studio/SparkSavedNextSteps.tsx`
- `lib/studio/create-spark.ts`
- `supabase/migrations/20260802_text_first_song_intelligence.sql`
