import { createConnectionHandler } from '../../../lib/design-connection.mjs';
import { designConfig } from '../../../lib/design-config.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const POST = createConnectionHandler(() => designConfig(process.env));
