'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ChapterFilter={chapter_number:number|null;chapter_title:string}
type BankQuestion={prompt:string;choices:string[];correct_index:number;content_area:string|null;subject_category:string|null;chapter_number:number|null;chapter_title:string|null;focused_retake_hint:string|null}

function subjectOf(q:BankQuestion){return (q.subject_category||q.content_area||'General / untagged').trim()}
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function chapterMatches(q:BankQuestion,filters:ChapterFilter[]){if(!filters.length)return true;return filters.some(f=>(f.chapter_number??null)===(q.chapter_number??null)&&(f.chapter_title||'').trim()===(q.chapter_title||'').trim())}
function shuffle<T>(items:T[]){const next=[...items];for(let i=next.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[next[i],next[j]]=[next[j],next[i]]}return next}

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
  const id=String(formData.get('id')||'').trim()
  const name=String(formData.get('name')||'').trim()
  const description=String(formData.get('description')||'').trim()
  const questionCount=Number(formData.get('question_count')||20)
  const duration=Number(formData.get('duration_minutes')||45)
  const passing=Number(formData.get('passing_score_percent')||70)
  const randomize=formData.get('randomize_questions')==='on'
  const onePerPage=formData.get('one_question_per_page')==='on'
  let chapterFilters:ChapterFilter[]=[]
  let subjectWeights:Record<string,number>={}
  try{
    const raw=JSON.parse(String(formData.get('chapter_filters')||'[]'))
    if(Array.isArray(raw))chapterFilters=raw.map((x:any)=>({chapter_number:Number.isInteger(x?.chapter_number)?x.chapter_number:null,chapter_title:String(x?.chapter_title||'').trim()}))
    const weights=JSON.parse(String(formData.get('subject_weights')||'{}'))
    if(weights&&typeof weights==='object'&&!Array.isArray(weights))subjectWeights=Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,Number(v)]).filter(([k,v])=>k.trim()&&Number.isFinite(v)&&v>0))
  }catch{redirect('/test-blueprints?error='+encodeURIComponent('Invalid blueprint configuration.'))}
  if(!name)redirect('/test-blueprints?error='+encodeURIComponent('Blueprint name is required.'))
  if(!Number.isInteger(questionCount)||questionCount<1||questionCount>200)redirect('/test-blueprints?error='+encodeURIComponent('Question count must be between 1 and 200.'))
  if(!Number.isInteger(duration)||duration<0||duration>600)redirect('/test-blueprints?error='+encodeURIComponent('Timer must be between 0 and 600 minutes.'))
  if(!Number.isInteger(passing)||passing<0||passing>100)redirect('/test-blueprints?error='+encodeURIComponent('Passing score must be between 0 and 100.'))
  const weightValues=Object.values(subjectWeights)
  if(weightValues.length&&Math.round(weightValues.reduce((a,b)=>a+b,0))!==100)redirect('/test-blueprints?error='+encodeURIComponent('Subject percentages must total 100%.'))
  const payload={teacher_id:user.id,name,description:description||null,chapter_filters:chapterFilters,subject_weights:subjectWeights,question_count:questionCount,duration_minutes:duration,passing_score_percent:passing,randomize_questions:randomize,one_question_per_page:onePerPage,updated_at:new Date().toISOString()}
  const query=id?supabase.from('teacher_test_blueprints').update(payload).eq('id',id).eq('teacher_id',user.id):supabase.from('teacher_test_blueprints').insert(payload)
  const{error}=await query
  if(error)redirect('/test-blueprints?error='+encodeURIComponent(error.code==='23505'?'You already have a blueprint with that name.':error.message))
  revalidatePath('/test-blueprints');revalidatePath('/tests/new')
  redirect('/test-blueprints?saved=1')
}

export async function deleteBlueprint(id:string){
  const{supabase,user}=await requireTeacher()
  const{error}=await supabase.from('teacher_test_blueprints').delete().eq('id',id).eq('teacher_id',user.id)
  if(error)redirect('/test-blueprints?error='+encodeURIComponent(error.message))
  revalidatePath('/test-blueprints');revalidatePath('/tests/new')
}

export async function generateFromBlueprint(id:string){
  const{supabase,user}=await requireTeacher()
  const{data:blueprint,error:blueprintError}=await supabase.from('teacher_test_blueprints').select('*').eq('id',id).eq('teacher_id',user.id).single()
  if(blueprintError||!blueprint)redirect('/test-blueprints?error='+encodeURIComponent(blueprintError?.message||'Blueprint not found.'))
  const{data:raw,error:bankError}=await supabase.from('question_bank').select('prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint').eq('teacher_id',user.id).limit(2000)
  if(bankError)redirect('/test-blueprints?error='+encodeURIComponent(bankError.message))
  const filters=(Array.isArray(blueprint.chapter_filters)?blueprint.chapter_filters:[]) as ChapterFilter[]
  const seen=new Set<string>()
  const candidates=(raw??[]).filter((q:any)=>chapterMatches(q,filters)).filter((q:any)=>{const key=normalize(q.prompt);if(!key||seen.has(key))return false;seen.add(key);return true}) as BankQuestion[]
  if(!candidates.length)redirect('/test-blueprints?error='+encodeURIComponent('No question-bank questions currently match this blueprint.'))
  const count=Math.min(Number(blueprint.question_count)||20,candidates.length)
  const cats=[...new Set(candidates.map(subjectOf))]
  const configured=(blueprint.subject_weights&&typeof blueprint.subject_weights==='object'&&!Array.isArray(blueprint.subject_weights)?blueprint.subject_weights:{}) as Record<string,number>
  const hasConfigured=Object.values(configured).some(v=>Number(v)>0)
  const weights:Record<string,number>={}
  if(hasConfigured){for(const cat of cats)weights[cat]=Number(configured[cat]||0)}else{for(const cat of cats)weights[cat]=100/cats.length}
  const allocations=cats.map(cat=>{const exact=count*(weights[cat]||0)/100;return{cat,count:Math.floor(exact),fraction:exact-Math.floor(exact)}})
  let assigned=allocations.reduce((sum,x)=>sum+x.count,0)
  allocations.sort((a,b)=>b.fraction-a.fraction)
  for(let i=0;assigned<count&&i<allocations.length;i++,assigned++)allocations[i].count++
  const chosen:BankQuestion[]=[];const chosenKeys=new Set<string>()
  for(const allocation of allocations){for(const q of shuffle(candidates.filter(x=>subjectOf(x)===allocation.cat))){if(allocation.count<=0)break;const key=normalize(q.prompt);if(chosenKeys.has(key))continue;chosen.push(q);chosenKeys.add(key);allocation.count--}}
  for(const q of shuffle(candidates)){if(chosen.length>=count)break;const key=normalize(q.prompt);if(!chosenKeys.has(key)){chosen.push(q);chosenKeys.add(key)}}
  const questions=shuffle(chosen).map(q=>({prompt:q.prompt,choices:q.choices,correctIndex:q.correct_index,contentArea:subjectOf(q),subjectCategory:subjectOf(q),chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',focusedRetakeHint:q.focused_retake_hint??'',sourceType:'blueprint'}))
  const chapterLabel=filters.length?filters.map(f=>f.chapter_number?`Chapter ${f.chapter_number}${f.chapter_title?` — ${f.chapter_title}`:''}`:f.chapter_title).filter(Boolean).join(', '):'Mixed chapters'
  const{data:testId,error:createError}=await supabase.rpc('create_test_with_questions_v6',{
    p_title:`${blueprint.name} — ${new Date().toLocaleDateString('en-US')}`,
    p_description:blueprint.description||`Generated from saved blueprint: ${blueprint.name}`,
    p_randomize:Boolean(blueprint.randomize_questions),
    p_duration_minutes:Number(blueprint.duration_minutes)||0,
    p_one_question_per_page:Boolean(blueprint.one_question_per_page),
    p_passing_score:Number(blueprint.passing_score_percent)||70,
    p_exam_preset:'custom',
    p_assessment_type:'chapter_exam',
    p_chapter_label:chapterLabel,
    p_questions:questions,
    p_questions_per_attempt:null,
    p_require_focused_retake_before_full:false,
    p_focused_retake_percent:50,
    p_focused_retake_min_score:0,
    p_focused_retake_hints:true,
    p_unlimited_attempts_until_due:false,
    p_max_attempts:1,
    p_due_at:null,
  })
  if(createError)redirect('/test-blueprints?error='+encodeURIComponent(createError.message))
  redirect(`/tests/${testId}`)
}
