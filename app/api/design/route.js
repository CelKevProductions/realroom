import { createDesignHandlers } from '../../../lib/design-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;
export const { GET, POST } = createDesignHandlers(() => ({
  key: process.env.OPENAI_API_KEY,
  accessCode: process.env.REALROOM_DESIGN_ACCESS_CODE,
  model: process.env.REALROOM_MODEL || 'gpt-6-astra',
}));
