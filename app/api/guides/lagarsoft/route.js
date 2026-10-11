import QRCode from 'qrcode';
import {APP_LAGARSOFT} from '@/lib/plans.js';
export const dynamic='force-static';
export async function GET(){return Response.json({url:APP_LAGARSOFT,qr:await QRCode.toDataURL(APP_LAGARSOFT,{errorCorrectionLevel:'M',margin:4,width:224})});}
