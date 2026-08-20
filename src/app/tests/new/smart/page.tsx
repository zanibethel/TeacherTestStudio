import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClassroomTestBuilder from '../ClassroomTestBuilder'
import { createTest, saveSubjectMixPreset } from '../actions'

function normalizeQuestion(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
type BundlePreset={preset_id:string;preset_title:string;bundle_id:string;bundle_title:string;question_count:number;collection_ids:string[];weights:Record<string,number>;subject_mappings:Record<string,string>}

export default async function SmartTest({searchParams}:{searchParams:Promise<{error?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const[{data:bankRaw},{data:previousRaw},{data:mixPresets},{data:bundlePresetData},{data:chapterRows},{data:subjectRows}]=await Promise.all([
    supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,source_type,focused_retake_hint,imported_collection_id').eq('teacher_id',user.id).order('updated_at',{ascending:false}).limit(2000),
    supabase.from('tests').select('id,title,updated_at,assessment_type,chapter_label,questions(id,prompt,position,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint,choices(id,label,position),question_answers(choice_id))').eq('teacher_id',user.id).order('updated_at',{ascending:false}).limit(50),
    supabase.from('teacher_subject_mix_presets').select('id,name,subject_weights').eq('teacher_id',user.id).order('updated_at',{ascending:false}),
    supabase.rpc('get_teacher_builder_bundle_presets'),
    supabase.from('question_bank_chapters').select('question_id,chapter_number,chapter_title').eq('teacher_id',user.id).limit(10000),
    supabase.from('question_bank_subjects').select('question_id,subject_category').eq('teacher_id',user.id).limit(10000)
  ])

  const chaptersByQuestion=new Map<string,any[]>();for(const row of chapterRows??[])chaptersByQuestion.set((row as any).question_id,[...(chaptersByQuestion.get((row as any).question_id)||[]),{number:(row as any).chapter_number??null,title:(row as any).chapter_title??''}])
  const subjectsByQuestion=new Map<string,string[]>();for(const row of subjectRows??[])subjectsByQuestion.set((row as any).question_id,[...(subjectsByQuestion.get((row as any).question_id)||[]),String((row as any).subject_category||'').trim()].filter(Boolean))
  const collectionIds=[...new Set((bankRaw??[]).map((q:any)=>q.imported_collection_id).filter(Boolean))]
  const{data:collections}=collectionIds.length?await supabase.from('shared_collections').select('id,title').in('id',collectionIds):{data:[] as any[]}
  const collectionTitle=new Map((collections??[]).map((c:any)=>[c.id,c.title]));const bundlePresets=(Array.isArray(bundlePresetData)?bundlePresetData:[]) as BundlePreset[];const collectionBundle=new Map<string,{bundle_id:string;bundle_title:string}>();for(const preset of bundlePresets){for(const collectionId of preset.collection_ids??[]){if(!collectionBundle.has(collectionId))collectionBundle.set(collectionId,{bundle_id:preset.bundle_id,bundle_title:preset.bundle_title})}}

  const bank=(bankRaw??[]).map((q:any)=>{const bundle=q.imported_collection_id?collectionBundle.get(q.imported_collection_id):undefined;const sourceKey=!q.imported_collection_id?'custom':bundle?`bundle:${bundle.bundle_id}`:`collection:${q.imported_collection_id}`;const sourceTitle=!q.imported_collection_id?'Custom':bundle?.bundle_title||collectionTitle.get(q.imported_collection_id)||'Imported resource';return{...q,subject_category:q.subject_category??q.content_area,bundle_title:sourceTitle,source_bucket_key:sourceKey,source_bucket_title:sourceTitle,chapters:chaptersByQuestion.get(q.id)||[],subjects:subjectsByQuestion.get(q.id)||[]}})
  const sourceMap=new Map<string,{key:string;title:string;kind:'custom'|'bundle'|'collection';bundleId:string|null;collectionIds:Set<string>;questionCount:number}>();for(const q of bank as any[]){const key=q.source_bucket_key;const current=sourceMap.get(key)??{key,title:q.source_bucket_title,kind:key==='custom'?'custom':key.startsWith('bundle:')?'bundle':'collection',bundleId:key.startsWith('bundle:')?key.slice(7):null,collectionIds:new Set<string>(),questionCount:0};current.questionCount++;if(q.imported_collection_id)current.collectionIds.add(q.imported_collection_id);sourceMap.set(key,current)}
  const sourceBuckets=[...sourceMap.values()].map(x=>({...x,collectionIds:[...x.collectionIds]})).sort((a,b)=>a.title.localeCompare(b.title));const bankByPrompt=new Map(bank.map((q:any)=>[normalizeQuestion(q.prompt),q]))

  const previousTests=(previousRaw??[]).map((test:any)=>({id:test.id,title:test.title,updated_at:test.updated_at,assessment_type:test.assessment_type,chapter_label:test.chapter_label,questions:[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position).map((q:any)=>{const choices=[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position);const answer=Array.isArray(q.question_answers)?q.question_answers[0]:q.question_answers;const correctIndex=Math.max(0,choices.findIndex((c:any)=>c.id===answer?.choice_id));const bankMatch=bankByPrompt.get(normalizeQuestion(q.prompt)) as any;return{id:q.id,prompt:q.prompt,choices:choices.map((c:any)=>c.label),correct_index:correctIndex,content_area:q.content_area,subject_category:q.subject_category??q.content_area,chapter_number:q.chapter_number,chapter_title:q.chapter_title,focused_retake_hint:q.focused_retake_hint,bank_id:bankMatch?.id??null,chapters:bankMatch?.chapters??[],subjects:bankMatch?.subjects??[]}})})).filter((t:any)=>t.questions.length)

  const query=await searchParams
  return <main>
    <div className="row between" style={{alignItems:'center',gap:12,flexWrap:'wrap'}}><Link href="/dashboard">← Dashboard</Link><Link href="/tests/new">Simple builder →</Link></div>
    <div style={{marginTop:18}}><span className="eyebrow">SMART TEST</span><h1 style={{margin:'5px 0'}}>Build from multiple sources</h1><p className="muted" style={{margin:0}}>Mix chapters or source banks, such as Chapters 1–3, and control how many questions come from each area.</p></div>
    {query.error&&<p className="bad notice">{query.error}</p>}
    <ClassroomTestBuilder action={createTest} saveMixPresetAction={saveSubjectMixPreset} bankQuestions={bank as any} previousTests={previousTests as any} sourceBuckets={sourceBuckets as any} bundlePresets={bundlePresets as any} initialMixPresets={(mixPresets??[]) as any}/>
  </main>
}
