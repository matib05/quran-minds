import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Next 16 removed `next lint`; ESLint 9 flat config is the supported path, and
// eslint-config-next ships flat config natively from v16.
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      // Generated from resources/ by scripts/build-quran-data.mjs.
      'lib/quran/data/**',
      '.pgdata/**',
    ],
  },
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),
];

export default config;
