'use server'

import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'

type TaggedQuestion={
 prompt:string
 content_area:string|null
 subject_category:string|null
 chapter_number:number|null
 chapter_title:string|null
}

type BankQuestion=TaggedQuestion&{
 choices:string[]
 correct_index:number
 focused_retake_hint:string|null
}

function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function subjectOf(q:TaggedQuestion){return (q.subject_category||q.content_area||'General / untagged').trim()}
function chapterKey(q:TaggedQuestion){return q.chapter_number?`n:${q.chapter_number}|${(q.chapter_title||'').trim()}`:q.chapter_title?`t:${q.chapter_title.trim()}`:''}
function shuffle<T>(items:T[]){const next=[...items];for(let i=next.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[next[i],next[j]]=[next[j],next[i]]}return next}

export async function generateAlternateVersion(testId:string){
 const supabase=await createClient()
 const{data:{user}}=await supabase.auth.getUser()
 if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
 if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

 const{data:test,error:testError}=await supabase.from('tests').select('id,teacher_id,title,description,duration_minutes,passing_score_percent,one_question_per_page,randomize_questions,questions_per_attempt,assessment_type,chapter_label,questions(prompt,content_area,subject_category,chapter_number,chapter_title)').eq('id',testId).eq('teacher_id',user.id).single()
 if(testError||!test)redirect(`/tests/${testId}/preview?error=${encodeURIComponent(testError?.message||'Test not found.')}`)
 const originals=(test.questions??[]) as TaggedQuestion[]
 if(!originals.length)redirect(`/tests/${testId}/preview?error=${encodeURIComponent('This test has no questions to use as a version blueprint.')}`)

 const{data:rawBank,error:bankError}=await supabase.from('question_bank').select('prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint').eq('teacher_id',user.id).limit(2000)
 if(bankError)redirect(`/tests/${testId}/preview?error=${encodeURIComponent(bankError.message)}`)
 const bank=(rawBank??[]) as BankQuestion[]
 if(!bank.length)redirect(`/tests/${testId}/preview?error=${encodeURIComponent('Add questions to your question bank before generating another version.')}`)

 const bankByPrompt=new Map(bank.map(q=>[normalize(q.prompt),q]))
 const enriched=originals.map(q=>{const match=bankByPrompt.get(normalize(q.prompt));return match?{...q,content_area:match.content_area,subject_category:match.subject_category,chapter_number:match.chapter_number,chapter_title:match.chapter_title}:q})
 const chapterKeys=new Set(enriched.map(chapterKey).filter(Boolean))
 const subjectCounts=new Map<string,number>()
 for(const q of enriched){const subject=subjectOf(q);subjectCounts.set(subject,(subjectCounts.get(subject)||0)+1)}
 const originalKeys=new Set(originals.map(q=>normalize(q.prompt)).filter(Boolean))
 const seen=new Set<string>()
 const eligible=bank.filter(q=>{const key=normalize(q.prompt);if(!key||seen.has(key))return false;seen.add(key);if(chapterKeys.size)return chapterKeys.has(chapterKey(q));if(subjectCounts.size)return subjectCounts.has(subjectOf(q));return true})
 const targetCount=originals.length
 if(eligible.length<targetCount)redirect(`/tests/${testId}/preview?error=${encodeURIComponent(`This version needs ${targetCount} questions, but only ${eligible.length} matching question-bank questions are available. Add more matching questions or broaden the original test first.`)}`)

 const subjects=[...subjectCounts.keys()]
 const allocations=subjects.map(subject=>{const exact=targetCount*((subjectCounts.get(subject)||0)/targetCount);return{subject,count:Math.floor(exact),fraction:exact-Math.floor(exact)}})
 let assigned=allocations.reduce((sum,x)=>sum+x.count,0)
 allocations.sort((a,b)=>b.fraction-a.fraction)
 for(let i=0;assigned<targetCount&&i<allocations.length;i++,assigned++)allocations[i].count++

 const chosen:BankQuestion[]=[]
 const chosenKeys=new Set<string>()
 const take=(items:BankQuestion[],amount:number)=>{for(const q of shuffle(items)){if(amount<=0)break;const key=normalize(q.prompt);if(chosenKeys.has(key))continue;chosen.push(q);chosenKeys.add(key);amount--}return amount}
 for(const allocation of allocations){
   const matching=eligible.filter(q=>subjectOf(q)===allocation.subject)
   let remaining=take(matching.filter(q=>!originalKeys.has(normalize(q.prompt))),allocation.count)
   if(remaining>0)remaining=take(matching.filter(q=>originalKeys.has(normalize(q.prompt))),remaining)
 }
 if(chosen.length<targetCount)take(eligible.filter(q=>!originalKeys.has(normalize(q.prompt))),targetCount-chosen.length)
 if(chosen.length<targetCount)take(eligible,targetCount-chosen.length)

 const questions=shuffle(chosen).map(q=>({prompt:q.prompt,choices:q.choices,correctIndex:q.correct_index,contentArea:subjectOf(q),subjectCategory:subjectOf(q),chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',focusedRetakeHint:q.focused_retake_hint??'',sourceType:'alternate_version'}))
 const reused=questions.filter(q=>originalKeys.has(normalize(q.prompt))).length
 const suffix=reused?` ${reused} question${reused===1?' was':'s were'} reused because matching inventory was limited.`:''
 const{data:newId,error:createError}=await supabase.rpc('create_test_with_questions_v6',{
   p_title:`${test.title} — New Version`,
   p_description:`${test.description||''}${test.description?'\n\n':''}Generated as a fresh version of ${test.title}.${suffix}`,
   p_randomize:Boolean(test.randomize_questions),
   p_duration_minutes:Number(test.duration_minutes)||0,
   p_one_question_per_page:Boolean(test.one_question_per_page),
   p_passing_score:Number(test.passing_score_percent)||70,
   p_exam_preset:'custom',
   p_assessment_type:test.assessment_type||'chapter_exam',
   p_chapter_label:test.chapter_label||'',
   p_questions:questions,
   p_questions_per_attempt:test.questions_per_attempt??null,
   p_require_focused_retake_before_full:false,
   p_focused_retake_percent:50,
   p_focused_retake_min_score:0,
   p_focused_retake_hints:true,
   p_unlimited_attempts_until_due:false,
   p_max_attempts:1,
   p_due_at:null,
 })
 if(createError)redirect(`/tests/${testId}/preview?error=${encodeURIComponent(createError.message)}`)
 redirect(`/tests/${newId}/preview?created=alternate&source=${encodeURIComponent(testId)}`)
}
