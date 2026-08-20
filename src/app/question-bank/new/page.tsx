import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import QuestionEditorFields,{ChapterOption,QuestionEditorValue} from '@/components/QuestionEditorFields'
import {createBankQuestion} from '../actions'

const blank:QuestionEditorValue={prompt:'',choices:['','','',''],correctIndex:0,chapterNumber:null,chapterTitle:'',subjectCategory:'',focusedRetakeHint:'',explanation:'',chapters:[],subjects:[]}

export default async function NewBankQuestion({searchParams}:{searchParams:Promise<{error?:string}>}){
 const query=await searchParams,supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const[{data:chapterRows},{data:subjectRows}]=await Promise.all([supabase.from('question_bank_chapters').select('chapter_number,chapter_title').eq('teacher_id',user.id).limit(2000),supabase.from('question_bank_subjects').select('subject_category').eq('teacher_id',user.id).limit(2000)])
 const chapters=[...new Map((chapterRows??[]).map((q:any)=>{const option:ChapterOption={number:q.chapter_number??null,title:q.chapter_title??''};return[`${option.number??''}|${option.title.toLowerCase()}`,option]})).values()]
 const subjects=[...new Set((subjectRows??[]).map((q:any)=>String(q.subject_category||'').trim()).filter(Boolean))]
 return <main className="narrow"><Link href="/question-bank">← Question bank</Link><h1>Add question</h1><p className="muted">Create one reusable question and tag it to every chapter or subject where it belongs. Re-entering the same question later will merge matching classifications instead of creating a duplicate.</p>{query.error&&<p className="bad notice">{query.error}</p>}<form action={createBankQuestion} className="card stack"><QuestionEditorFields value={blank} chapterOptions={chapters as ChapterOption[]} subjectOptions={subjects} names={{prompt:'prompt',chapterNumber:'chapter_number',chapterTitle:'chapter_title',subjectCategory:'subject_category',chaptersJson:'chapters_json',subjectsJson:'subjects_json',choices:'choices',correctIndex:'correct_index',focusedRetakeHint:'focused_retake_hint',explanation:'explanation'}}/><div className="row"><button>Save question</button><Link href="/question-bank" className="secondary button">Cancel</Link></div></form></main>
}
