"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PRODUCTION_CREDIT_FIELDS } from "@/lib/production-credits";

export async function saveProductionCredits(
  formData: FormData,
) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not available.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const slug = String(formData.get("slug") || "").trim();
  const songId = String(formData.get("song_id") || "").trim();
  const songVersionId = String(
    formData.get("song_version_id") || "",
  ).trim();
  const isPublic =
    formData.get("credits_are_public") === "on";

  if (!slug || !songId || !songVersionId) {
    throw new Error(
      "A song and primary song version are required.",
    );
  }

  const { data: ownedSong, error: ownedSongError } =
    await supabase
      .from("songs")
      .select("id")
      .eq("id", songId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

  if (ownedSongError || !ownedSong) {
    throw new Error(
      ownedSongError?.message ||
        "Song not found or not owned by you.",
    );
  }

  const credits = PRODUCTION_CREDIT_FIELDS.map(
    (field, index) => ({
      role_key: field.key,
      credit_value: String(
        formData.get(`credit_${field.key}`) || "",
      ).trim(),
      sort_order: index,
    }),
  ).filter((credit) => credit.credit_value);

  const { error } = await (supabase as any).rpc(
    "replace_song_version_credits",
    {
      p_song_id: songId,
      p_song_version_id: songVersionId,
      p_is_public: isPublic,
      p_credits: credits,
    },
  );

  if (error) {
    throw new Error(
      `Production credits save failed: ${error.message}`,
    );
  }

  revalidatePath(`/studio/songs/${slug}/edit`);
  revalidatePath(`/songs/${slug}`);
  revalidatePath("/listen");
  revalidatePath("/studio");

  redirect(`/studio/songs/${slug}/edit?view=full#credits`);
}
