import index from '@/data/styles-visuels.json';

// Même index statique dans la démo et sur le serveur ; aucun modèle ML dans le navigateur.
export const dynamic = 'force-static';
export function GET() { return Response.json(index); }
