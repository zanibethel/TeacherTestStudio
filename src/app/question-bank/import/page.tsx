import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import ImportStager from './ImportStager'
import {importApprovedBankQuestions} from '../actions'

type ChapterTag={number:number|null;title:string}

export default async function QuestionBankImport(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const[{data:questions},{data:chapterRows},{data:subjectRows}]=await Promise.all([
  supabase.from('question_bank').select('id,prompt,choices,correct_index').eq('teacher_id',user.id).order('updated_at',{ascending:false}).limit(3000),
  supabase.from('question_bank_chapters').select('question_id,chapter_number,chapter_title').eq('teacher_id',user.id).limit(10000),
  supabase.from('question_bank_subjects').select('question_id,subject_category').eq('teacher_id',user.id).limit(10000)
 ])
 const chaptersByQuestion=new Map<string,ChapterTag[]>();for(const row of chapterRows??[]){const id=String((row as any).question_id),tag={number:(row as any).chapter_number??null,title:String((row as any).chapter_title||'')};chaptersByQuestion.set(id,[...(chaptersByQuestion.get(id)||[]),tag])}
 const subjectsByQuestion=new Map<string,string[]>();for(const row of subjectRows??[]){const id=String((row as any).question_id),subject=String((row as any).subject_category||'').trim();if(subject)subjectsByQuestion.set(id,[...(subjectsByQuestion.get(id)||[]),subject])}
 const existing=(questions??[]).map((question:any)=>({id:question.id,prompt:question.prompt,choices:Array.isArray(question.choices)?question.choices.map(String):[],correct_index:Number(question.correct_index)||0,chapters:chaptersByQuestion.get(question.id)||[],subjects:subjectsByQuestion.get(question.id)||[]}))
 const chapterOptions=[...new Map((chapterRows??[]).map((row:any)=>{const tag:ChapterTag={number:row.chapter_number??null,title:String(row.chapter_title||'')};return[`${tag.number??''}|${tag.title.toLowerCase()}`,tag]})).values()].filter(tag=>tag.number!==null||tag.title).sort((a,b)=>(a.number??9999)-(b.number??9999)||a.title.localeCompare(b.title))
 const subjectOptions=[...new Set((subjectRows??[]).map((row:any)=>String(row.subject_category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
 return <main className="narrow"><Link href="/question-bank">← Question bank</Link><h1>Import questions</h1><p className="muted">Stage, compare, classify, and review questions before anything is added to your bank.</p><ImportStager existing={existing} chapterOptions={chapterOptions} subjectOptions={subjectOptions} action={importApprovedBankQuestions}/></main>
}
