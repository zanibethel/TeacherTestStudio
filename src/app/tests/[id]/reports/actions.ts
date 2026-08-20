'use server'

import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'

type WeakChapter={chapter_number:number|null;chapter_title:string|null;chapter:string;mastery:number;answered:number}
type WeakSubject={subject:string;mastery:number;answered:number}

function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function shuffle<T>(items:T[]){const next=[...items];for(let i=next.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[next[i],next[j]]=[next[j],next[i]]}return next}

export async function buildClassRemediation(testId:string){
 const supabase=await createClient()
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const{data:test}=await supabase.from('tests').select('id,teacher_id,title,description,duration_minutes,passing_score_percent,one_question_per_page').eq('id',testId).single()
 if(!test||test.teacher_id!==user.id)redirect('/dashboard')
 const{data:mastery,error:masteryError}=await supabase.rpc('get_teacher_test_mastery_report',{p_test_id:testId})
 if(masteryError)redirect(`/tests/${testId}/reports?error=${encodeURIComponent(masteryError.message)}`)
 const subjects=(Array.isArray(mastery?.subjects)?mastery.subjects:[]) as WeakSubject[]
 const chapters=(Array.isArray(mastery?.chapters)?mastery.chapters:[]) as WeakChapter[]
 if(!subjects.length&&!chapters.length)redirect(`/tests/${testId}/reports?error=${encodeURIComponent('No submitted mastery data is available yet.')}`)
 const threshold=Math.max(70,Number(test.passing_score_percent||70))
 const weakSubjects=(subjects.filter(x=>Number(x.mastery)<threshold).length?subjects.filter(x=>Number(x.mastery)<threshold):subjects.slice(0,1)).slice(0,2)
 const weakChapters=(chapters.filter(x=>Number(x.mastery)<threshold).length?chapters.filter(x=>Number(x.mastery)<threshold):chapters.slice(0,1)).slice(0,2)
 const subjectSet=new Set(weakSubjects.map(x=>normalize(String(x.subject||''))).filter(Boolean))
 const chapterKeys=new Set(weakChapters.map(x=>`${x.chapter_number??''}|${normalize(String(x.chapter_title||''))}`))
 const{data:raw,error:qError}=await supabase.from('questions').select('id,prompt,position,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint,choices(id,label,position),question_answers(choice_id)').eq('test_id',testId).order('position')
 if(qError)redirect(`/tests/${testId}/reports?error=${encodeURIComponent(qError.message)}`)
 const scored=(raw??[]).map((q:any)=>{
   const subject=String(q.subject_category||q.content_area||'General review')
   const subjectWeak=subjectSet.has(normalize(subject))
   const chapterWeak=chapterKeys.has(`${q.chapter_number??''}|${normalize(String(q.chapter_title||''))}`)
   return{q,priority:subjectWeak&&chapterWeak?3:subjectWeak||chapterWeak?2:0}
 }).filter(x=>x.priority>0)
 if(!scored.length)redirect(`/tests/${testId}/reports?error=${encodeURIComponent('No original test questions matched the weak chapter or subject tags.')}`)
 const ordered=[...shuffle(scored.filter(x=>x.priority===3)),...shuffle(scored.filter(x=>x.priority===2))]
 const target=Math.min(20,ordered.length)
 const chosen=ordered.slice(0,target).map(({q}:any)=>{
   const choices=[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position)
   const answer=Array.isArray(q.question_answers)?q.question_answers[0]:q.question_answers
   const correctIndex=Math.max(0,choices.findIndex((c:any)=>c.id===answer?.choice_id))
   return{prompt:q.prompt,choices:choices.map((c:any)=>c.label),correctIndex,contentArea:String(q.subject_category||q.content_area||'General review'),subjectCategory:String(q.subject_category||q.content_area||'General review'),chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',focusedRetakeHint:q.focused_retake_hint??'',sourceType:'mastery_remediation'}
 })
 const focusLabels=[...weakChapters.map(x=>x.chapter),...weakSubjects.map(x=>x.subject)].filter(Boolean)
 const{data:newId,error:createError}=await supabase.rpc('create_test_with_questions_v6',{
   p_title:`${test.title} — Remediation`,
   p_description:`Targeted remediation generated from class mastery: ${focusLabels.join(' · ')}`,
   p_randomize:true,
   p_duration_minutes:Math.min(Number(test.duration_minutes||30),30),
   p_one_question_per_page:Boolean(test.one_question_per_page),
   p_passing_score:Number(test.passing_score_percent||70),
   p_exam_preset:'custom',
   p_assessment_type:'chapter_exam',
   p_chapter_label:weakChapters.map(x=>x.chapter).filter(Boolean).join(', ')||'Targeted remediation',
   p_questions:chosen,
   p_questions_per_attempt:null,
   p_require_focused_retake_before_full:false,
   p_focused_retake_percent:50,
   p_focused_retake_min_score:0,
   p_focused_retake_hints:true,
   p_unlimited_attempts_until_due:false,
   p_max_attempts:1,
   p_due_at:null,
 })
 if(createError)redirect(`/tests/${testId}/reports?error=${encodeURIComponent(createError.message)}`)
 redirect(`/tests/${newId}/preview?created=remediation`)
}
