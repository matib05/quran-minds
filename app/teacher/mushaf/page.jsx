import { redirect } from 'next/navigation';

/** The page picker on /teacher/mushaf/[page] submits here. */
export default function MushafIndex({ searchParams }) {
  const page = Number(searchParams?.page);
  redirect(`/teacher/mushaf/${Number.isInteger(page) && page >= 1 && page <= 604 ? page : 1}`);
}
