import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/auth";
import StudioLifecycleV1 from "@/components/studio/StudioLifecycleV1";
import { getStudioLifecycleSongs } from "@/lib/studio/lifecycle";

export const dynamic = "force-dynamic";

export default async function StudioV1Page() {
  const { user } = await getServerAuthContext();

  if (!user) {
    redirect("/auth/sign-in?next=/studio/v1");
  }

  const songs = await getStudioLifecycleSongs(user.id);

  return (
    <section className="section">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Studio</div>
            <h1 className="h2">Songcatcher Studio</h1>
            <p className="copy" style={{ maxWidth: 820 }}>
              Catch what arrives. Craft what matters. Release it when it is ready.
              Listen to what comes back.
            </p>
            <div className="copy" style={{ marginTop: "0.45rem", fontWeight: 750 }}>
              {songs.length} {songs.length === 1 ? "Song" : "Songs"}
            </div>
          </div>

          <Link className="button primary" href="/studio/capture">
            + Catch a Spark
          </Link>
        </div>

        <StudioLifecycleV1 initialSongs={songs} />
      </div>
    </section>
  );
}
