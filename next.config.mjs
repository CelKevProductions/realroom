// Configuration Next.js de RealRoom
// Previews qui testent l'encyclopédie : la mission 5 et l'aménagement vivant (variété,
// relations entre coins, remplissage). La production reste sans encyclopédie par défaut.
const BRANCHES_ENCYCLOPEDIE = ['codex/realroom-mission5-encyclopedie-2026-10-12', 'amenagement-vivant', 'experiment-ssr'];
// Essai privé des statistiques apprises sur des pièces réelles : cette branche seulement, en preview.
const previewPriorSsr = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'experiment-ssr'
  && process.env.REALROOM_PRIOR_SSR !== '0' && process.env.NEXT_PUBLIC_REALROOM_PRIOR_SSR !== '0';
const previewMission5 = process.env.VERCEL_ENV === 'preview'
  && BRANCHES_ENCYCLOPEDIE.includes(process.env.VERCEL_GIT_COMMIT_REF)
  && process.env.REALROOM_ENCYCLOPEDIE !== '0'
  && process.env.NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE !== '0';
const nextConfig = {
  // Activation de cette preview seulement ; aucun secret dans le bundle client.
  ...(previewMission5 || previewPriorSsr ? { env: {
    ...(previewMission5 ? { REALROOM_ENCYCLOPEDIE: '1', NEXT_PUBLIC_REALROOM_ENCYCLOPEDIE: '1' } : {}),
    ...(previewPriorSsr ? { REALROOM_PRIOR_SSR: '1', NEXT_PUBLIC_REALROOM_PRIOR_SSR: '1' } : {})
  } } : {}),
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
