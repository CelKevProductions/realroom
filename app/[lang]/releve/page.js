import ReleveMobile from '@/components/piece/ReleveMobile.js';
export const metadata={title:'Relevé mobile',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}){const {lang}=await params;return <ReleveMobile lang={lang}/>;}
