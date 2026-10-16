// Configuration Next.js de RealRoom
const previewMission5 = process.env.VERCEL_ENV === 'preview'
  && process.env.VERCEL_GIT_COMMIT_REF === 'codex/realroom-mission5-encyclopedie-2026-10-12'
  && process.env.REALROOM_ENCYCLOPEDIE !== '0'
  && process.env.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE !== '0';
const nextConfig = {
  // Activation de cette preview seulement ; aucun secret dans le bundle client.
  ...(previewMission5 ? { env: { REALROOM_ENCYCLOPEDIE: '1', NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE: '1' } } : {}),
  poweredByHeader: false,
  // Postgres embarqué (développement) : jamais empaqueté ni envoyé en ligne
  serverExternalPackages: ['@electric-sql/pglite'],
  // attention : ces motifs valent aussi au milieu d'un chemin (« build/** » retirait node_modules/next/dist/build
  // des fonctions Vercel, d'où des erreurs 500 sur toutes les pages rendues à la demande)
  outputFileTracingExcludes: { '*': ['node_modules/@electric-sql/**', './.data/**', './.essais/**'] },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
      ]
    }];
  }
};
export default nextConfig;
