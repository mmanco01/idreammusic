type MusePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function MusePage({ params }: MusePageProps) {
  const { slug } = await params;

  return (
    <main>
      <h1>{slug}</h1>
      <p>Muse page is under construction.</p>
    </main>
  );
}
