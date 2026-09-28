// Configuration Next.js de RealRoom
const nextConfig = {
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
