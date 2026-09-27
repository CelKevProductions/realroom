import { ImageResponse } from 'next/og';
import { texte } from '@/lib/i18n.js';

export const alt = 'RealRoom';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// image de partage : le titre sur papier chaud, la marque en coin
export default async function Image({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#F6F3EE', color: '#1E1C19' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1E1C19', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 26, height: 26, background: '#C2502A', transform: 'rotate(45deg)' }} />
          </div>
          RealRoom
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{t.accueil.titre}</div>
        <div style={{ fontSize: 30, color: '#5A554D' }}>{t.accueil.surtitre}</div>
      </div>
    ),
    size
  );
}
