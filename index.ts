import { execSync } from 'node:child_process';
import { start, servePage, cleanupPage } from './server.js';

export interface PromptOptions {
  system?: string;
  user: string;
}

export interface SummarizeOptions {
  text: string;
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  format?: 'plain-text' | 'markdown';
  length?: 'short' | 'medium' | 'long';
}

export interface TranslateOptions {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface WriteOptions {
  prompt: string;
  tone?: 'neutral' | 'formal' | 'informal';
  format?: 'plain-text' | 'markdown';
  length?: 'short' | 'medium' | 'long';
}

const PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><pre id="r" style="white-space:pre-wrap;word-break:break-word">pending</pre>
<script>
(async()=>{
const e=document.getElementById('r');
try{
const A='__API__';
if(A==='prompt'){
 const a=globalThis.LanguageModel;
 if(!a){e.textContent='ERROR:no-prompt-api';return}
 const v=await a.availability({expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]});
 if(v==='unavailable'){e.textContent='ERROR:unavailable';return}
 e.textContent='running';
 const s=await a.create({initialPrompts:[{role:'system',content:__SYSTEM__}],expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]});
 try{const t=await s.prompt(__USER__);e.textContent='OK:\\n'+t}finally{if(s.destroy)s.destroy()}
}else if(A==='summarize'){
 const a=globalThis.Summarizer;
 if(!a){e.textContent='ERROR:no-summarizer-api';return}
 const v=await a.availability();
 if(v==='unavailable'){e.textContent='ERROR:unavailable';return}
 e.textContent='running';
 const s=await a.create({type:__SUM_TYPE__,format:__FORMAT__,length:__LENGTH__});
 try{const t=await s.summarize(__USER__);e.textContent='OK:\\n'+t}finally{if(s.destroy)s.destroy()}
}else if(A==='translate'){
 const a=globalThis.Translator;
 if(!a){e.textContent='ERROR:no-translator-api';return}
 const v=await a.availability();
 if(v==='unavailable'){e.textContent='ERROR:unavailable';return}
 e.textContent='running';
 const s=await a.create({sourceLanguage:__SOURCE_LANG__,targetLanguage:__TARGET_LANG__});
 try{const t=await s.translate(__USER__);e.textContent='OK:\\n'+t}finally{if(s.destroy)s.destroy()}
}else if(A==='write'){
 const a=globalThis.Writer;
 if(!a){e.textContent='ERROR:no-writer-api';return}
 e.textContent='running';
 const s=await a.create({tone:__TONE__,format:__FORMAT__,length:__LENGTH__});
 try{const t=await s.write(__USER__);e.textContent='OK:\\n'+t}finally{if(s.destroy)s.destroy()}
}
}catch(err){e.textContent='ERROR:'+err.message}
})();
</script></body></html>`;

function ab(args: string[], timeout = 60): string {
  return execSync(`agent-browser ${args.join(' ')}`, {
    timeout: timeout * 1000,
    encoding: 'utf-8',
  }).trim();
}

async function callApi(type: string, opts: Record<string, unknown> = {}): Promise<string> {
  await start();
  const {
    system, user,
    text,
    type: sumType, format, length,
    sourceLanguage, targetLanguage,
    tone,
  } = opts as Record<string, string | undefined>;

  const html = PAGE
    .replaceAll('__API__', type)
    .replace('__SYSTEM__', JSON.stringify(system ?? ''))
    .replaceAll('__USER__', JSON.stringify(user ?? text ?? ''))
    .replace('__SUM_TYPE__', JSON.stringify(sumType ?? 'key-points'))
    .replaceAll('__FORMAT__', JSON.stringify(format ?? 'plain-text'))
    .replaceAll('__LENGTH__', JSON.stringify(length ?? 'medium'))
    .replace('__SOURCE_LANG__', JSON.stringify(sourceLanguage ?? 'en'))
    .replace('__TARGET_LANG__', JSON.stringify(targetLanguage ?? 'es'))
    .replace('__TONE__', JSON.stringify(tone ?? 'neutral'));

  const { id, url } = servePage(html);
  try {
    ab(['open', url], 15);
    ab(['wait', '35000'], 50);
    const result = ab(['get', 'text', '#r'], 10);
    if (result.startsWith('ERROR:')) throw new Error(result.slice(6));
    if (result.startsWith('OK:\n')) return result.slice(4);
    return result;
  } finally {
    cleanupPage(id);
  }
}

export function prompt(opts: PromptOptions): Promise<string> {
  return callApi('prompt', opts as unknown as Record<string, unknown>);
}

export function summarize(opts: SummarizeOptions): Promise<string> {
  return callApi('summarize', opts as unknown as Record<string, unknown>);
}

export function translate(opts: TranslateOptions): Promise<string> {
  return callApi('translate', opts as unknown as Record<string, unknown>);
}

export function write(opts: WriteOptions): Promise<string> {
  return callApi('write', opts as unknown as Record<string, unknown>);
}
