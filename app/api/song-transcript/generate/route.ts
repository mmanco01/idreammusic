import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OpenAITranscriptionResponse = {
  text?: string;
  error?: { message?: string };
};

function jsonError(message: string, status = 500) {
  return NextResponse.json({ status: 'error', message }, { status });
}

export async function POST(request: Request) {
  try {
    // Bracket access plus a forced Node.js route keeps this lookup server-only
    // and evaluates it inside the deployed Vercel Function.
    const apiKey = process.env['OPENAI_API_KEY']?.trim();

    if (!apiKey) {
      const runtimeName = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
      return jsonError(
        `OPENAI_API_KEY is unavailable inside the transcription function (runtime: ${runtimeName}).`,
        500
      );
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return jsonError('Supabase is not available.', 500);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError('You must be signed in.', 401);
    }

    const formData = await request.formData();
    const slug = String(formData.get('slug') || '');
    const songId = String(formData.get('song_id') || '');
    const attachmentId = String(formData.get('attachment_id') || '');

    if (!songId || !attachmentId) {
      return jsonError('Choose an audio recording first.', 400);
    }

    const { data: ownedSong, error: ownedSongError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', songId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (ownedSongError || !ownedSong) {
      return jsonError(
        ownedSongError?.message || 'Song not found or not owned by you.',
        403
      );
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .select('id, song_id, song_version_id, bucket, storage_path, mime_type, title, file_type')
      .eq('id', attachmentId)
      .eq('song_id', songId)
      .eq('file_type', 'audio')
      .maybeSingle();

    if (attachmentError || !attachment) {
      return jsonError(
        attachmentError?.message || 'Audio attachment not found for this song.',
        404
      );
    }

    const bucket = attachment.bucket || 'song-assets';
    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(attachment.storage_path);

    if (downloadError || !audioBlob) {
      return jsonError(
        `Audio download failed: ${downloadError?.message || 'No file returned.'}`,
        500
      );
    }

    const maxBytes = 25 * 1024 * 1024;
    if (audioBlob.size > maxBytes) {
      return jsonError(
        'This recording is larger than 25 MB. Upload a smaller audio file for transcription.',
        413
      );
    }

    const originalName =
      attachment.storage_path.split('/').pop() || attachment.title || 'recording.mp3';
    const audioFile = new File([audioBlob], originalName, {
      type: attachment.mime_type || audioBlob.type || 'audio/mpeg',
    });

    const openAIForm = new FormData();
    openAIForm.append('file', audioFile);
    openAIForm.append('model', 'gpt-4o-mini-transcribe');
    openAIForm.append('response_format', 'json');

    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAIForm,
      cache: 'no-store',
    });

    const responseText = await openAIResponse.text();
    let result: OpenAITranscriptionResponse = {};

    try {
      result = JSON.parse(responseText) as OpenAITranscriptionResponse;
    } catch {
      // The raw response is used in the error below.
    }

    if (!openAIResponse.ok) {
      return jsonError(
        `OpenAI transcription failed: ${
          result.error?.message || responseText || openAIResponse.statusText
        }`,
        openAIResponse.status
      );
    }

    const transcriptText = String(result.text || '').trim();
    if (!transcriptText) {
      return jsonError('OpenAI returned an empty transcript.', 502);
    }

    const now = new Date().toISOString();
    const { data: existingTranscript, error: existingError } = await supabase
      .from('song_transcripts')
      .select('id')
      .eq('song_id', songId)
      .eq('attachment_id', attachmentId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return jsonError(`Transcript lookup failed: ${existingError.message}`, 500);
    }

    if (existingTranscript) {
      const { error } = await supabase
        .from('song_transcripts')
        .update({
          transcript_text: transcriptText,
          transcript_source: 'ai',
          transcription_model: 'gpt-4o-mini-transcribe',
          language_code: 'en',
          is_reviewed: false,
          reviewed_at: null,
          reviewed_by: null,
          updated_at: now,
        })
        .eq('id', existingTranscript.id)
        .eq('song_id', songId);

      if (error) {
        return jsonError(`Transcript update failed: ${error.message}`, 500);
      }
    } else {
      const { error } = await supabase.from('song_transcripts').insert({
        song_id: songId,
        song_version_id: attachment.song_version_id || null,
        attachment_id: attachmentId,
        transcript_text: transcriptText,
        transcript_source: 'ai',
        language_code: 'en',
        transcription_model: 'gpt-4o-mini-transcribe',
        is_reviewed: false,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        return jsonError(`Transcript insert failed: ${error.message}`, 500);
      }
    }

    revalidatePath(`/studio/songs/${slug}/edit`);
    revalidatePath('/studio');

    return NextResponse.json({
      status: 'success',
      message: 'Transcript generated and saved. Review it against the recording before analytics.',
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Transcript generation failed.',
      500
    );
  }
}
