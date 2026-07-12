import "./globals.css";

export const metadata = {
  title: { default: "Quran Minds", template: "%s · Quran Minds" },
  description: "Precise Quran memorization, review, and progress tracking for students, families, and teachers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
