# iDreamMusic Song Journey v1.0

**Accepted:** August 5, 2026  
**Production:** https://idreammusic.com  
**Status:** Deployed, live-tested, and accepted  
**Version:** 1.0.0  
**Tag:** `song-journey-v1.0.0`  
**Production commit:** `217d6dd`

## Purpose

This release establishes the first accepted end-to-end authenticated songwriter journey:

**Studio â†’ Catch â†’ Transcribe when needed â†’ Understand â†’ Collaborate â†’ Shape**

## Accepted journey

### Studio Home
- Focused decision page instead of the full catalog.
- Catch a new Spark, continue recommended work, or deliberately browse the portfolio.
- One recommended action is visually dominant.

### Unified Spark Capture
- One common capture flow for typed words, direct recording, uploaded audio, documents, notes, or mixed material.
- All capture types create the same private Spark and guided continuation.
- New Sparks remain private by default.

### Text-first Song Intelligence
- Text-only Sparks can run analysis without audio.
- Results include summary, early ratings, strengths, development opportunities, next move, Muse direction, and starter question.

### Transcript-first audio
- Uploaded and recorded audio move to transcription before Song Intelligence.
- The songwriter can review and correct the transcript.
- Analysis combines reviewed transcript with any typed or document material.

### Action hierarchy
- Gold is reserved for the recommended action.
- Secondary, tertiary, informational, and destructive states are visually distinct.
- Informational badges do not resemble buttons.

### Processing feedback
- Saving, transcription, Song Intelligence, Muse thinking, and Council refresh show visible activity.
- Duplicate submissions are prevented while processing.

### Muse handoff
- Song Intelligence recommends a lead Muse and prefills a useful question.
- The songwriter remains in control; the question is not automatically sent.

### Summary-first Muse Council
- Lead Muse, top insights, agreement, productive difference, and one next move appear before full responses.
- Full Muse responses remain expandable.
- Muse thinking shows animated activity.

## Production validation

Validated on the live production website:

- Text-only Spark â†’ Song Intelligence â†’ recommended Muse
- Uploaded audio â†’ transcription â†’ review â†’ Song Intelligence
- Direct recording â†’ transcription â†’ review â†’ Song Intelligence
- Mixed text/audio material
- Simplified Studio Home
- Readable action hierarchy
- Animated processing feedback
- Summary-first Council with zero, one, and multiple Muse responses
- Desktop and mobile authenticated experience

## Frozen baseline rules

Future changes must:

1. Begin from current `main`.
2. Use a dedicated feature branch.
3. Preserve **Catch â†’ Understand â†’ Collaborate**.
4. Preserve transcript review before audio-based analysis.
5. Keep one visually dominant recommended next action.
6. Pass `npm run typecheck`.
7. Pass `npm run build`.
8. Be validated through the relevant preview or production journey.

## Deferred enhancements

- Progressive disclosure across the remaining Song Workbench
- Further simplification of credits, sharing, metrics, and administration
- Anonymous-user conversion refinements
- Additional mobile polish
- Activation analytics
- Muse Learning Center
- Community systems

## Recovery point

The immutable tag `song-journey-v1.0.0` marks this accepted baseline. Do not move or reuse it.

