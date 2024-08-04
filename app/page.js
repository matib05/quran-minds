import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-100 flex-col items-center text-center justify-between p-24">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-extrabold leading-[1.15] sm:text-6xl sm:leading-[1.15]">
          <span className="bg-gradient-to-r from-red-600 via-red-500 to-red-400 bg-clip-text text-transparent">Quran</span>
          <br />
          <span className="bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent">Minds</span>
        </h1>
        <h2 className="mt-5 text-gray-600 sm:text-xl">QuranMinds is the Quran Memorization Assistance platform for students, teachers, and Islamic Schools</h2>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-2 lg:text-center">
        <Link
          href="review/input"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-red-50 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Review{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`text-sm opacity-50 lg:text-center`}>
            Select your revision portion and begin answering the Quran Minds Auto Generated Questions
          </p>
        </Link>

        <Link
          href="memorize/input"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-red-50 hover:dark:border-neutral-700 hover:dark:bg-neutral-800 hover:dark:bg-opacity-30"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Memorize{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`text-sm opacity-50 lg:text-center`}>
            Select your memorization portion and begin the Quran Minds Interactive Memorization process
          </p>
        </Link>

      </div>
    </main>
  );
}
