import { ImageResponse } from 'next/og';
import { texte } from '@/lib/i18n.js';

export const alt = 'RealRoom';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// image de partage (« Maison douce ») : le titre sur fond crème et pastel, la pastille en coin
export default async function Image({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, color: '#26232B',
        background: 'radial-gradient(700px 500px at 88% 12%, #FFD9C6, transparent 70%), radial-gradient(640px 520px at 6% 100%, #DCEEDF, transparent 70%), #F6F0E8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 60, height: 60, borderRadius: 30, display: 'flex', overflow: 'hidden', flexWrap: 'wrap' }}>
            <div style={{ width: 30, height: 30, background: '#FFE08A' }} />
            <div style={{ width: 30, height: 30, background: '#F2613F' }} />
            <div style={{ width: 30, height: 30, background: '#DCD5F6' }} />
            <div style={{ width: 30, height: 30, background: '#C5DDC9' }} />
          </div>
          RealRoom
        </div>
        <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1, letterSpacing: -3, maxWidth: 980 }}>{t.accueil.titre}</div>
        <div style={{ fontSize: 30, color: '#6E6873' }}>{t.accueil.surtitre}</div>
      </div>
    ),
    size
  );
}
