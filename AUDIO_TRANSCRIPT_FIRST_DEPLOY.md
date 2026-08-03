# Audio Transcript-First Follow-Up

## Purpose

This follow-up keeps text-only Sparks on the direct Song Intelligence path while making audio Sparks follow the safer sequence:

`Save Spark → Transcribe recording → Review/correct transcript → Save Transcript and Run Song Intelligence → Muse direction`

## What changed

### 1. Material-aware post-save handoff

`SparkSavedNextSteps` now chooses the primary action from the saved material:

- Text only: **Run Song Intelligence**
- Audio without a transcript: **Transcribe My Recording**
- Text plus audio without a transcript: **Transcribe and Strengthen Analysis**
- Audio with an unreviewed transcript: **Review Transcript**
- Audio with a reviewed transcript: **Run Song Intelligence**

Audio transcription no longer silently falls through to text-only analysis. The songwriter is taken to the transcript review section before analysis.

### 2. Transcript appears before Song Intelligence

For songs with audio, the workbench now shows two explicit steps:

1. **Transcribe and review**
2. **Run Song Intelligence**

The transcription control appears above the transcript editor. Song Intelligence remains locked until the selected recording has a saved, reviewed transcript.

### 3. One combined continuation button

After reviewing the words, the songwriter can choose:

- **Save transcript**
- **Save Transcript and Run Song Intelligence**

The combined action saves the corrected transcript, marks it reviewed, and starts Song Intelligence with the saved transcript ID. Server-side validation prevents the combined action when the review checkbox is not selected.

## Files changed

- `app/studio/songs/[slug]/edit/actions.ts`
- `app/studio/songs/[slug]/edit/page.tsx`
- `components/studio/SongIntelligencePanel.tsx`
- `components/studio/SparkSavedNextSteps.tsx`

No additional Supabase migration is required for this follow-up. The earlier `20260802_text_first_song_intelligence.sql` migration is still required.

## Apply

Run from the repository root after the Unified Spark Intelligence patch has already been applied:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\path\to\apply-audio-transcript-first.ps1"
```

Then validate:

```cmd
npm run typecheck
npm run build
```

## Smoke tests

### Text-only Spark

1. Capture typed words without audio.
2. Save the Spark.
3. Confirm the primary action is **Run Song Intelligence**.
4. Run it and confirm results appear.

### Audio-only Spark

1. Capture or upload audio without typed words.
2. Save the Spark.
3. Confirm the primary action is **Transcribe My Recording**.
4. Generate the transcript.
5. Confirm the workbench opens at **Step 1 · Transcribe and review**.
6. Correct the transcript and check the review box.
7. Click **Save Transcript and Run Song Intelligence**.
8. Confirm analysis runs only after the transcript saves.

### Text plus audio

1. Capture both typed words and audio.
2. Save the Spark.
3. Confirm the primary action is **Transcribe and Strengthen Analysis**.
4. Complete transcript review.
5. Confirm Song Intelligence uses the reviewed transcript plus saved text.

### Existing transcript

1. Open an audio Spark with an unreviewed transcript.
2. Confirm the primary action is **Review Transcript**.
3. Mark it reviewed and save.
4. Confirm the Step 2 Song Intelligence button unlocks.
