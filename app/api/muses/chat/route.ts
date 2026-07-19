import { calliopeMuseProfile } from "@/lib/muses/calliope";
import { calliopeSystemPrompt } from "@/lib/muses/prompts/calliope";

export async function POST(request: Request) {
  const body = await request.json();

  const {
    museSlug,
    message,
    songId,
  } = body;

  if (museSlug !== "calliope") {
    return Response.json(
      { error: "Unsupported Muse" },
      { status: 400 }
    );
  }

  const song = songId
    ? await getSongById(songId)
    : null;

  const knowledge = await getRelevantMuseKnowledge({
    museSlug: "calliope",
    query: message,
  });

  const context = {
    profile: calliopeMuseProfile,
    song,
    knowledge,
  };

  // Send system prompt + context + user message to OpenAI.
}
