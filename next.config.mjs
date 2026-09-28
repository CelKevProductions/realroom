// Configuration Next.js de RealRoom
const nextConfig = {
  poweredByHeader: false,
  // Postgres embarqué (développement) : jamais empaqueté ni envoyé en ligne
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingExcludes: { '*': ['node_modules/@electric-sql/**', '.data/**', 'tests/**', 'outils/**', 'build/**', '.essais/**'] },
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
