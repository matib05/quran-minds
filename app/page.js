import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { homeFor } from '@/lib/auth/guards';

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="quran-lg text-primary" dir="rtl">
        وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Al-Qamar 17</p>

      <h1 className="mt-10 text-4xl font-semibold tracking-tight sm:text-5xl">Quran Minds</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Hifdh management for students, teachers, parents and Islamic schools. Sabaq, Sabqi and
        Manzil — assigned, practised, heard and measured in one place.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        <Pillar
          arabic="سَبَق"
          title="Sabaq"
          body="Today’s new memorization, broken into phrases the student can actually learn."
        />
        <Pillar
          arabic="سَبْقِي"
          title="Sabqi"
          body="Recent pages, reinforced daily until they hold."
        />
        <Pillar
          arabic="مَنْزِل"
          title="Manzil"
          body="Long-term revision, scheduled around what is actually getting weak."
        />
      </ul>

      <div className="mt-10">
        <Link
          href="/login"
          className="inline-flex h-11 items-center rounded-md bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Qur’an text: Tanzil.net Uthmani (minimal) edition. Structural metadata: Tanzil Quran
        Metadata v1.0, CC BY 3.0.
      </p>
    </main>
  );
}

function Pillar({ arabic, title, body }) {
  return (
    <li className="rounded-lg border surface-mushaf p-4">
      <span className="quran text-2xl text-primary">{arabic}</span>
      <h2 className="mt-1 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </li>
  );
}
