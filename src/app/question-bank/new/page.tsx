import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import QuestionEditorFields,{ChapterOption,QuestionEditorValue} from '@/components/QuestionEditorFields'
import {createBankQuestion} from '../actions'

const blank:QuestionEditorValue={prompt:'',choices:['','','',''],correctIndex:0,chapterNumber:null,chapterTitle:'',subjectCategory:'',focusedRetakeHint:'',explanation:''}

export default async function NewBankQuestion({searchParams}:{searchParams:Promise<{error?:string}>}){
 const query=await searchParams,supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const{data:meta}=await supabase.from('question_bank').select('chapter_number,chapter_title,subject_category,content_area').eq('teacher_id',user.id).limit(1000)
 const chapters=[...new Map((meta??[]).filter((q:any)=>q.chapter_number||q.chapter_title).map((q:any)=>{const option:ChapterOption={number:q.chapter_number??null,title:q.chapter_title??''};return[`${option.number??''}|${option.title}`,option]})).values()]
 const subjects=[...new Set((meta??[]).map((q:any)=>String(q.subject_category||q.content_area||'').trim()).filter(Boolean))]
 return <main className="narrow"><Link href="/question-bank">← Question bank</Link><h1>Add question</h1><p className="muted">Create a reusable bank question. Chapter and subject help Smart Test organize it, but both are optional.</p>{query.error&&<p className="bad notice">{query.error}</p>}<form action={createBankQuestion} className="card stack"><QuestionEditorFields value={blank} chapterOptions={chapters as ChapterOption[]} subjectOptions={subjects} names={{prompt:'prompt',chapterNumber:'chapter_number',chapterTitle:'chapter_title',subjectCategory:'subject_category',choices:'choices',correctIndex:'correct_index',focusedRetakeHint:'focused_retake_hint',explanation:'explanation'}}/><div className="row"><button>Save question</button><Link href="/question-bank" className="secondary button">Cancel</Link></div></form></main>
}
