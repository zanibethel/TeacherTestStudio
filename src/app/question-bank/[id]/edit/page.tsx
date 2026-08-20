import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuestionEditorFields,{ChapterOption,QuestionEditorValue} from '@/components/QuestionEditorFields'
import { updateBankQuestion } from '../../actions'

export default async function EditBankQuestion({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:q}=await supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,explanation,focused_retake_hint,source_type,shared_question_id').eq('id',id).eq('teacher_id',user.id).single();if(!q)notFound()
  const{data:meta}=await supabase.from('question_bank').select('chapter_number,chapter_title,subject_category,content_area').eq('teacher_id',user.id).limit(1000)
  const chapters=[...new Map((meta??[]).filter((item:any)=>item.chapter_number||item.chapter_title).map((item:any)=>{const option:ChapterOption={number:item.chapter_number??null,title:item.chapter_title??''};return[`${option.number??''}|${option.title}`,option]})).values()]
  const subjects=[...new Set((meta??[]).map((item:any)=>String(item.subject_category||item.content_area||'').trim()).filter(Boolean))]
  const value:QuestionEditorValue={prompt:q.prompt,choices:Array.isArray(q.choices)?q.choices.map(String):['',''],correctIndex:q.correct_index??0,chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',subjectCategory:q.subject_category??q.content_area??'',focusedRetakeHint:q.focused_retake_hint??'',explanation:q.explanation??'',sourceType:q.source_type}
  return <main className="narrow"><Link href="/question-bank">← Question bank</Link><h1>Edit your question</h1>{q.shared_question_id&&<p className="muted">This question was copied from the shared library. Your edits only affect your personal bank.</p>}{query.error&&<p className="bad notice">{query.error}</p>}<form action={updateBankQuestion.bind(null,id)} className="card stack"><QuestionEditorFields value={value} chapterOptions={chapters as ChapterOption[]} subjectOptions={subjects} names={{prompt:'prompt',chapterNumber:'chapter_number',chapterTitle:'chapter_title',subjectCategory:'subject_category',choices:'choices',correctIndex:'correct_index',focusedRetakeHint:'focused_retake_hint',explanation:'explanation'}}/><button>Save my version</button></form></main>
}
