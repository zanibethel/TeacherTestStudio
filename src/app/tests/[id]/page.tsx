import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createShareOffer,setShareActive,setTestStatus } from './actions'
import ShareSetupForm from './ShareSetupForm'
import ShareReports from './ShareReports'

type StudentSummaryRow={name:string;best:number;attempts:any[]}

export default async function TestDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;created?:string;token?:string;audience?:string;label?:string}>}){
 const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('teacher_plan,teacher_plan_expires_at').eq('id',user.id).single();const proActive=profile?.teacher_plan==='pro'&&(!profile.teacher_plan_expires_at||new Date(profile.teacher_plan_expires_at).getTime()>Date.now())
 const{data:test}=await supabase.from('tests').select('id,title,description,status,share_code,randomize_questions,teacher_id,questions_per_attempt,questions(id,prompt,position,choices(id,label,position)),attempts(id,share_id,score_percent,correct_count,total_questions,submitted_at,student_id,attempt_number,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,student:profiles!attempts_student_id_fkey(full_name))').eq('id',id).single();if(!test||test.teacher_id!==user.id)notFound()
 const[{data:roster},{data:groups},{data:shares},{data:presets}]=await Promise.all([
  supabase.from('teacher_student_roster').select('id,student_email,student_id').eq('teacher_id',user.id).order('student_email'),
  supabase.from('teacher_groups').select('id,name,teacher_group_members(count)').eq('teacher_id',user.id).order('name'),
  supabase.from('test_shares').select('id,token,label,experience_name,delivery_mode,restricted_mode,audience_mode,access_mode,payment_mode,max_attempts,unlimited_attempts_until_due,due_at,require_focused_retake_before_full,focused_retake_percent,focused_retake_min_score,focused_retake_hints,access_duration_days,study_guide_enabled,focused_retake_enabled,randomized_retest_enabled,link_expires_at,price_cents,teacher_revenue_share_bps,active,created_at').eq('test_id',id).order('created_at',{ascending:false}),
  supabase.from('teacher_share_experience_presets').select('id,name,settings').eq('teacher_id',user.id).order('updated_at',{ascending:false})
 ])
 const questions=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position);const attempts=[...(test.attempts??[])].sort((a:any,b:any)=>String(b.submitted_at).localeCompare(String(a.submitted_at)));const completed=attempts.filter((a:any)=>a.submitted_at)
 const studentSummary=new Map<string,StudentSummaryRow>();for(const a of completed){const student=Array.isArray(a.student)?a.student[0]:a.student;const key=String(a.student_id);const existing=studentSummary.get(key);const row:StudentSummaryRow=existing??{name:student?.full_name||'Student',best:0,attempts:[] as any[]};row.best=Math.max(row.best,Number(a.score_percent||0));row.attempts.push(a as any);studentSummary.set(key,row)}
 const audienceGroups=(groups??[]).map((g:any)=>({id:g.id,name:g.name,member_count:g.teacher_group_members?.[0]?.count??0}))
 const audienceRoster=(roster??[]).map((r:any)=>({id:r.id,student_email:r.student_email,student_id:r.student_id??null}))
 const createdShare=(shares??[]).find((s:any)=>s.id===query.created)
 const createdUrl=query.token?`https://cramloop.app/share/${query.token}`:createdShare?`https://cramloop.app/share/${createdShare.token}`:null
 const audienceLabel=query.audience==='groups'?'selected group(s)':query.audience==='students'?'selected student(s)':'anyone with the link'
 return <main><Link href="/dashboard">← Dashboard</Link><div className="row between"><div><h1>{test.title}</h1><p className="muted">{test.description||'No summary'}</p></div><span className="pill">{test.status}</span></div>{query.error&&<p className="bad">{query.error}</p>}

  <section className="card"><div className="row between"><div><h2>Reusable test</h2><p className="muted">{questions.length} questions in pool · {test.questions_per_attempt||questions.length} shown per full test. Deadlines and retake rules are set separately for each share.</p></div><form action={setTestStatus.bind(null,id,test.status==='published'?'draft':'published')}><button>{test.status==='published'?'Unpublish test':'Publish test'}</button></form></div><p>Question order: <b>{test.randomize_questions?'Randomized':'Fixed'}</b></p></section>

  <section className="card stack"><div><h2>Share this test</h2><p className="muted">Choose a testing experience to prefill the assignment rules, then adjust anything you need. Custom setups can be saved as your own reusable presets.</p></div>
   {query.created&&createdUrl&&<section id="share-success" className="card" style={{border:'2px solid #86efac',background:'#f0fdf4',margin:0}}><span className="eyebrow">ASSIGNMENT CREATED</span><h3 style={{margin:'6px 0'}}>{query.label||createdShare?.label||'Share created successfully'}</h3><p style={{margin:'4px 0'}}>This test has been assigned to <b>{audienceLabel}</b>.</p><p className="muted" style={{margin:'4px 0 10px'}}>You do not need to create another share unless you want a different audience or assignment setup.</p><div className="row" style={{flexWrap:'wrap',gap:8}}><a className="button" href={createdUrl}>View assignment</a><a className="secondary button" href={createdUrl}>Open share link</a><Link className="secondary button" href={`/reports?assignment=${query.created}`}>View report</Link></div><p className="muted" style={{wordBreak:'break-all',marginBottom:0}}>{createdUrl}</p></section>}
   <form action={createShareOffer.bind(null,id)} className="stack">
    <ShareSetupForm roster={audienceRoster} groups={audienceGroups} presets={(presets??[]) as any} proActive={proActive} fullQuestionCount={test.questions_per_attempt||questions.length}/>
    <button>Create share link</button>
   </form></section>

  <ShareReports testTitle={test.title} shares={(shares??[]) as any} attempts={attempts as any}/>

  <section className="card"><h2>Share links / assignments</h2>{!(shares??[]).length?<p className="muted">No share links yet.</p>:(shares??[]).map((s:any)=>{const url=`https://cramloop.app/share/${s.token}`;return <div className="question-summary" key={s.id}><div className="row between"><div><b>{s.label||'Untitled share'}</b><p className="muted">{s.experience_name||'Custom experience'}</p><p><a href={url}>{url}</a></p></div><span className="pill">{s.active?'Active':'Disabled'}</span></div><form action={setShareActive.bind(null,id,s.id,!s.active)}><button className="secondary">{s.active?'Disable link':'Enable link'}</button></form></div>})}</section>

  <section className="card"><h2>Questions ({questions.length})</h2>{questions.map((q:any)=><div className="question-summary" key={q.id}><b>{q.position}. {q.prompt}</b><p className="muted">{q.choices?.length??0} choices</p></div>)}</section>
  <section className="card"><h2>Overall test history ({completed.length} completed attempts)</h2><p className="muted">This combines submitted attempts across all shares of this reusable test. Use Assignment reports above for share-specific results.</p>{studentSummary.size===0?<p className="muted">No completed attempts yet.</p>:[...studentSummary.entries()].map(([studentId,row])=><div className="question-summary" key={studentId}><div className="row between"><div><b>{row.name}</b><p className="muted">{row.attempts.length} completed attempt{row.attempts.length===1?'':'s'}</p></div><div><b>Highest grade: {row.best}%</b></div></div>{row.attempts.sort((a:any,b:any)=>a.attempt_number-b.attempt_number).map((a:any)=><div className="result-row" key={a.id}><div><b>Attempt {a.attempt_number}</b><p className="muted">{new Date(a.submitted_at).toLocaleString()}{a.auto_submitted?' · Auto-submitted':''}</p></div><div><b>{a.score_percent}%</b><p className="muted">{a.correct_count}/{a.total_questions} correct · {a.integrity_violation_count} integrity event(s)</p></div><Link href={`/attempts/${a.id}`}>Attempt details</Link></div>)}</div>)}</section>
 </main>
}
