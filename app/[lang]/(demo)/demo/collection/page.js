import Collection from '@/components/demo/Collection.js';

export const metadata = { title: 'La collection', robots: { index: false, follow: false } };

// Démo sans compte : tous les meubles, éléments et revêtements procéduraux, dans une pièce témoin.
export default function PageCollection() {
  return <Collection />;
}
