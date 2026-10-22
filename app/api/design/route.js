import { createDesignHandlers } from '../../../lib/design-http.mjs';
import { designConfig } from '../../../lib/design-config.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;
export const { GET, POST, DELETE } = createDesignHandlers(() => designConfig(process.env));
