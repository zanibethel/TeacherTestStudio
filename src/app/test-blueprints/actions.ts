'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ChapterFilter={chapter_number:number|null;chapter_title:string}
type SourceFilter={key:string;title:string;collection_ids:string[]}
type BankQuestion={prompt:string;choices:string[];correct_index:number;content_area:string|null;subject_category:string|null;chapter_number:number|null;chapter_title:string|null;focused_retake_hint:string|null;imported_collection_id:string|null}

function subjectOf(q:BankQuestion){return (q.subject_category||q.content_area||'General / untagged').trim()}
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function chapterMatches(q:BankQuestion,filters:ChapterFilter[]){if(!filters.length)return true;return filters.some(f=>(f.chapter_number??null)===(q.chapter_number??null)&&(f.chapter_title||'').trim()===(q.chapter_title||'').trim())}
function balanced(labels:string[]){if(!labels.length)return{} as Record<string,number>;const base=Math.floor(100/labels.length);let remainder=100-base*labels.length;return Object.fromEntries(labels.map(label=>[label,base+(remainder-->0?1:0)])) as Record<string,number>}
function allocate(labels:string[],weights:Record<string,number>,count:number){const rows=labels.map(label=>{const exact=count*(Number(weights[label])||0)/100;return{label,count:Math.floor(exact),fraction:exact-Math.floor(exact)}});let used=rows.reduce((s,r)=>s+r.count,0);for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction)){if(used>=count)break;row.count++;used++}return Object.fromEntries(rows.map(r=>[r.label,r.count])) as Record<string,number>}
function sourceKey(q:BankQuestion,filters:SourceFilter[]){if(!q.imported_collection_id)return'custom';const match=filters.find(f=>f.collection_ids.includes(q.imported_collection_id!));return match?.key||`collection:${q.imported_collection_id}`}

async function requireTeacher(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  return{supabase,user}
}

export async function saveBlueprint(formData:FormData){
  const{supabase,user}=await requireTeacher()
  const id=String(formData.get('id')||'').trim(),name=String(formData.get('name')||'').trim(),description=String(formData.get('description')||'').trim()
  const questionCount=Number(formData.get('question_count')||20),duration=Number(formData.get('duration_minutes')||45),passing=Number(formData.get('passing_score_percent')||70)
  const randomize=formData.get('randomize_questions')==='on',onePerPage=formData.get('one_question_per_page')==='on'
  let chapterFilters:ChapterFilter[]=[],sourceFilters:SourceFilter[]=[],subjectWeights:Record<string,number>={},sourceWeights:Record<string,number>={}
  try{
    const chapters=JSON.parse(String(formData.get('chapter_filters')||'[]'));if(Array.isArray(chapters))chapterFilters=chapters.map((x:any)=>({chapter_number:Number.isInteger(x?.chapter_number)?x.chapter_number:null,chapter_title:String(x?.chapter_title||'').trim()}))
    const sources=JSON.parse(String(formData.get('source_filters')||'[]'));if(Array.isArray(sources))sourceFilters=sources.map((x:any)=>({key:String(x?.key||'').trim(),title:String(x?.title||'').trim(),collection_ids:Array.isArray(x?.collection_ids)?x.collection_ids.map(String):[]})).filter((x:SourceFilter)=>x.key)
    for(const [field,target] of [['subject_weights',subjectWeights],['source_weights',sourceWeights]] as const){const raw=JSON.parse(String(formData.get(field)||'{}'));if(raw&&typeof raw==='object'&&!Array.isArray(raw)){for(const[k,v]of Object.entries(raw)){const n=Number(v);if(k.trim()&&Number.isFinite(n)&&n>=0&&n<=100)target[k.trim()]=n}}}
  }catch{redirect('/test-blueprints?error='+encodeURIComponent('Invalid blueprint configuration.'))}
  if(!name)redirect('/test-blueprints?error='+encodeURIComponent('Blueprint name is required.'))
  if(!Number.isInteger(questionCount)||questionCount<1||questionCount>200)redirect('/test-blueprints?error='+encodeURIComponent('Question count must be between 1 and 200.'))
  if(!Number.isInteger(duration)||duration<0||duration>600)redirect('/test-blueprints?error='+encodeURIComponent('Timer must be between 0 and 600 minutes.'))
  if(!Number.isInteger(passing)||passing<0||passing>100)redirect('/test-blueprints?error='+encodeURIComponent('Passing score must be between 0 and 100.'))
  for(const[label,weights]of [['Subject',subjectWeights],['Source',sourceWeights]] as const){const values=Object.values(weights);if(values.length&&Math.round(values.reduce((a,b)=>a+b,0))!==100)redirect('/test-blueprints?error='+encodeURIComponent(`${label} percentages must total 100%.`))}
  const payload={teacher_id:user.id,name,description:description||null,chapter_filters:chapterFilters,source_filters:sourceFilters,subject_weights:subjectWeights,source_weights:sourceWeights,question_count:questionCount,duration_minutes:duration,passing_score_percent:passing,randomize_questions:randomize,one_question_per_page:onePerPage,updated_at:new Date().toISOString()}
  const query=id?supabase.from('teacher_test_blueprints').update(payload).eq('id',id).eq('teacher_id',user.id):supabase.from('teacher_test_blueprints').insert(payload)
  const{error}=await query;if(error)redirect('/test-blueprints?error='+encodeURIComponent(error.code==='23505'?'You already have a blueprint with that name.':error.message))
  revalidatePath('/test-blueprints');revalidatePath('/tests/new');redirect('/test-blueprints?saved=1')
}

export async function deleteBlueprint(id:string){const{supabase,user}=await requireTeacher();const{error}=await supabase.from('teacher_test_blueprints').delete().eq('id',id).eq('teacher_id',user.id);if(error)redirect('/test-blueprints?error='+encodeURIComponent(error.message));revalidatePath('/test-blueprints');revalidatePath('/tests/new')}

export async function generateFromBlueprint(id:string){
  const{supabase,user}=await requireTeacher()
  const{data:blueprint,error:blueprintError}=await supabase.from('teacher_test_blueprints').select('*').eq('id',id).eq('teacher_id',user.id).single();if(blueprintError||!blueprint)redirect('/test-blueprints?error='+encodeURIComponent(blueprintError?.message||'Blueprint not found.'))
  const{data:raw,error:bankError}=await supabase.from('question_bank').select('prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint,imported_collection_id').eq('teacher_id',user.id).limit(3000);if(bankError)redirect('/test-blueprints?error='+encodeURIComponent(bankError.message))
  const chapters=(Array.isArray(blueprint.chapter_filters)?blueprint.chapter_filters:[]) as ChapterFilter[],sources=(Array.isArray(blueprint.source_filters)?blueprint.source_filters:[]) as SourceFilter[]
  const selectedSourceKeys=sources.map(s=>s.key),seen=new Set<string>()
  const candidates=(raw??[]).filter((q:any)=>chapterMatches(q,chapters)).filter((q:any)=>!sources.length||selectedSourceKeys.includes(sourceKey(q,sources))).filter((q:any)=>{const key=normalize(q.prompt);if(!key||seen.has(key))return false;seen.add(key);return true}) as BankQuestion[]
  if(!candidates.length)redirect('/test-blueprints?error='+encodeURIComponent('No question-bank questions currently match this blueprint.'))
  const count=Math.min(Number(blueprint.question_count)||20,candidates.length),subjects=[...new Set(candidates.map(subjectOf))],sourceKeys=[...new Set(candidates.map(q=>sourceKey(q,sources)))]
  const configuredSubjects=(blueprint.subject_weights&&typeof blueprint.subject_weights==='object'&&!Array.isArray(blueprint.subject_weights)?blueprint.subject_weights:{}) as Record<string,number>,configuredSources=(blueprint.source_weights&&typeof blueprint.source_weights==='object'&&!Array.isArray(blueprint.source_weights)?blueprint.source_weights:{}) as Record<string,number>
  const subjectWeights=Object.values(configuredSubjects).some(v=>Number(v)>0)?Object.fromEntries(subjects.map(s=>[s,Number(configuredSubjects[s]||0)])):balanced(subjects)
  const sourceWeights=Object.values(configuredSources).some(v=>Number(v)>0)?Object.fromEntries(sourceKeys.map(s=>[s,Number(configuredSources[s]||0)])):balanced(sourceKeys)
  if(Math.round(Object.values(subjectWeights).reduce((a,b)=>a+b,0))!==100||Math.round(Object.values(sourceWeights).reduce((a,b)=>a+b,0))!==100)redirect('/test-blueprints?error='+encodeURIComponent('This blueprint no longer maps to a complete 100% mix. Edit it to rebalance the currently available sources/subjects.'))
  const subjectTargets=allocate(subjects,subjectWeights,count),sourceTargets=allocate(sourceKeys,sourceWeights,count),subjectUsed:Record<string,number>={},sourceUsed:Record<string,number>={},chosen:BankQuestion[]=[],used=new Set<string>()
  while(chosen.length<count){const available=candidates.filter(q=>!used.has(normalize(q.prompt)));if(!available.length)break;let best:BankQuestion|undefined,bestScore=-Infinity;for(const q of available){const subject=subjectOf(q),source=sourceKey(q,sources),sn=(subjectTargets[subject]||0)-(subjectUsed[subject]||0),bn=(sourceTargets[source]||0)-(sourceUsed[source]||0),score=(sn>0?100+sn:sn)+(bn>0?100+bn:bn)+Math.random();if(score>bestScore){bestScore=score;best=q}}if(!best)break;used.add(normalize(best.prompt));chosen.push(best);const subject=subjectOf(best),source=sourceKey(best,sources);subjectUsed[subject]=(subjectUsed[subject]||0)+1;sourceUsed[source]=(sourceUsed[source]||0)+1}
  const questions=chosen.sort(()=>Math.random()-.5).map(q=>({prompt:q.prompt,choices:q.choices,correctIndex:q.correct_index,contentArea:subjectOf(q),subjectCategory:subjectOf(q),chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',focusedRetakeHint:q.focused_retake_hint??'',sourceType:'blueprint'}))
  const chapterLabel=chapters.length?chapters.map(f=>f.chapter_number?`Chapter ${f.chapter_number}${f.chapter_title?` — ${f.chapter_title}`:''}`:f.chapter_title).filter(Boolean).join(', '):'Mixed chapters'
  const{data:testId,error:createError}=await supabase.rpc('create_test_with_questions_v6',{p_title:`${blueprint.name} — ${new Date().toLocaleDateString('en-US')}`,p_description:blueprint.description||`Generated from saved blueprint: ${blueprint.name}`,p_randomize:Boolean(blueprint.randomize_questions),p_duration_minutes:Number(blueprint.duration_minutes)||0,p_one_question_per_page:Boolean(blueprint.one_question_per_page),p_passing_score:Number(blueprint.passing_score_percent)||70,p_exam_preset:'custom',p_assessment_type:'chapter_exam',p_chapter_label:chapterLabel,p_questions:questions,p_questions_per_attempt:null,p_require_focused_retake_before_full:false,p_focused_retake_percent:50,p_focused_retake_min_score:0,p_focused_retake_hints:true,p_unlimited_attempts_until_due:false,p_max_attempts:1,p_due_at:null})
  if(createError)redirect('/test-blueprints?error='+encodeURIComponent(createError.message));redirect(`/tests/${testId}/preview?created=blueprint`)
}
