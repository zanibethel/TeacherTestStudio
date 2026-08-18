'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PSI_STARTER_BANK } from '@/lib/psiStarterBank'

function normalize(v:string){return v.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function shuffle<T>(items:T[]){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

type PoolQ={prompt:string;choices:string[];correctIndex:number;contentArea:string;source?:string}

function balancedPick(pool:PoolQ[],count:number){
  const groups=new Map<string,PoolQ[]>()
  for(const item of shuffle(pool)){const key=item.contentArea||'General';const arr=groups.get(key)||[];arr.push(item);groups.set(key,arr)}
  const keys=shuffle([...groups.keys()]);const picked:PoolQ[]=[]
  let cursor=0
  while(picked.length<count&&keys.length){
    const key=keys[cursor%keys.length];const arr=groups.get(key)!
    const next=arr.shift();if(next)picked.push(next)
    if(!arr.length){groups.delete(key);keys.splice(cursor%keys.length,1);if(!keys.length)break;continue}
    cursor++
  }
  return picked
}

export async function installStarterBank(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const rows=PSI_STARTER_BANK.map(x=>({teacher_id:user.id,prompt:x.prompt,normalized_prompt:normalize(x.prompt),choices:x.choices,correct_index:x.correctIndex,content_area:x.contentArea,explanation:x.explanation||null,source_type:'generated'}))
  const{error}=await supabase.from('question_bank').upsert(rows,{onConflict:'teacher_id,normalized_prompt',ignoreDuplicates:true})
  if(error)redirect('/psi-builder?error='+encodeURIComponent(error.message))
  revalidatePath('/psi-builder');revalidatePath('/question-bank')
  redirect('/psi-builder?message='+encodeURIComponent(`${rows.length} starter questions are available in your question bank.`))
}

export async function generatePsiPractice(formData:FormData){
  const count=Number(formData.get('question_count')||50)
  if(![25,50,100].includes(count))redirect('/psi-builder?error=Choose+25%2C+50%2C+or+100+questions')
  const includePersonal=formData.get('include_personal')==='on'
  const title=String(formData.get('title')||`Texas Cosmetology Practice — ${count} Questions`).trim()
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='teacher')redirect('/dashboard')
  const starter:PoolQ[]=PSI_STARTER_BANK.map(x=>({...x,source:'starter'}))
  let personal:PoolQ[]=[]
  if(includePersonal){const{data}=await supabase.from('question_bank').select('prompt,choices,correct_index,content_area').eq('teacher_id',user.id);personal=(data||[]).map((x:any)=>({prompt:x.prompt,choices:Array.isArray(x.choices)?x.choices:[],correctIndex:x.correct_index,contentArea:x.content_area||'General',source:'personal'}))}
  const seen=new Set<string>();const combined:PoolQ[]=[]
  for(const item of shuffle([...personal,...starter])){const n=normalize(item.prompt);if(!n||seen.has(n)||item.choices.length<2)continue;seen.add(n);combined.push(item)}
  if(combined.length<count)redirect('/psi-builder?error='+encodeURIComponent(`Only ${combined.length} unique questions are available. Add more questions to the bank first.`))
  const selected=balancedPick(combined,count)
  const duration=count===100?120:count===50?60:30
  const{data,error}=await supabase.rpc('create_test_with_questions_v3',{p_title:title,p_description:'Original Texas cosmetology licensing-exam practice questions. Not affiliated with or endorsed by PSI or TDLR.',p_randomize:true,p_duration_minutes:duration,p_one_question_per_page:true,p_passing_score:70,p_exam_preset:'tdlr_operator_written',p_assessment_type:'psi_practice',p_chapter_label:'',p_questions:selected.map(x=>({prompt:x.prompt,choices:x.choices,correctIndex:x.correctIndex,contentArea:x.contentArea}))})
  if(error)redirect('/psi-builder?error='+encodeURIComponent(error.message))
  await supabase.from('tests').update({randomize_choices:true,max_attempts:3,review_mode:'immediate'}).eq('id',data)
  redirect(`/tests/${data}`)
}
