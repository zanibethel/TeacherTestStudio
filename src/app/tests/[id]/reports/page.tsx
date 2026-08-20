import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {buildClassRemediation} from './actions'

type Row={name:string;best:number;attempts:any[]}

function trendLabel(value:string){
 if(value==='improving')return 'Improving'
 if(value==='slipping')return 'Slipping'
 if(value==='steady')return 'Steady'
 return 'Baseline'
}

function masteryClass(value:number){return value<65?'bad':value<80?'muted':'good'}

export default async function TestReports({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
 const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const{data:test}=await supabase.from('tests').select('id,teacher_id,title,passing_score_percent').eq('id',id).single();if(!test||test.teacher_id!==user.id)notFound()
 const[{data:attempts},{data:mastery}]=await Promise.all([
  supabase.from('attempts').select('id,student_id,attempt_number,score_percent,correct_count,total_questions,started_at,submitted_at,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,student:profiles!attempts_student_id_fkey(full_name)').eq('test_id',id).not('submitted_at','is',null).order('submitted_at',{ascending:false}),
  supabase.rpc('get_teacher_test_mastery_report',{p_test_id:id})
 ])
 const rows=new Map<string,Row>();for(const a of attempts??[]){const s=Array.isArray((a as any).student)?(a as any).student[0]:(a as any).student;const key=String((a as any).student_id);const row:Row=rows.get(key)??{name:s?.full_name||'Student',best:0,attempts:[]};row.best=Math.max(row.best,Number((a as any).score_percent||0));row.attempts.push(a as any);rows.set(key,row)}
 const completed=attempts??[];const avg=completed.length?Math.round(completed.reduce((sum:number,a:any)=>sum+Number(a.score_percent||0),0)/completed.length):0;const passCount=completed.filter((a:any)=>Number(a.score_percent||0)>=Number(test.passing_score_percent||70)).length
 const studentProgress=Array.isArray(mastery?.students)?mastery.students:[]
 const subjects=Array.isArray(mastery?.subjects)?mastery.subjects:Array.isArray(mastery?.areas)?mastery.areas:[]
 const chapters=Array.isArray(mastery?.chapters)?mastery.chapters:[]
 const needsHelp=Number(mastery?.needs_help_count||0)
 const improving=Number(mastery?.improving_count||0)
 const progressByStudent=new Map(studentProgress.map((s:any)=>[String(s.student_id),s]))
 const weakestSubject=subjects[0]
 const weakestChapter=chapters[0]
 const canRemediate=completed.length>0&&(subjects.length>0||chapters.length>0)
 return <main>
  <div className="row between"><div><Link href="/dashboard">← Test library</Link><h1>{test.title} reports</h1><p className="muted">Analyze scores by chapter and subject, identify who needs help, and build targeted remediation from the measured weak areas.</p></div><div className="row" style={{gap:8,flexWrap:'wrap'}}><Link className="secondary button" href={`/tests/${id}/preview`}>Student view</Link>{canRemediate&&<form action={buildClassRemediation.bind(null,id)}><button>Build remediation draft</button></form>}</div></div>
  {query.error&&<p className="bad notice">{query.error}</p>}
  <section className="card" style={{padding:'12px 16px'}}><div className="row" style={{gap:8,flexWrap:'wrap',alignItems:'center'}}><span className="pill">1 · Build ✓</span><span aria-hidden>→</span><span className="pill">2 · Review ✓</span><span aria-hidden>→</span><span className="pill">3 · Assign ✓</span><span aria-hidden>→</span><span className="pill">4 · Analyze</span></div></section>
  <div className="settings-grid"><section className="card"><b>{completed.length}</b><p className="muted">Completed attempts</p></section><section className="card"><b>{avg}%</b><p className="muted">Average score</p></section><section className="card"><b>{passCount}</b><p className="muted">Passing attempts</p></section><section className="card"><b>{needsHelp}</b><p className="muted">Students needing help</p></section></div>

  {studentProgress.length>0&&<section className="card"><div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><h2 style={{marginBottom:4}}>Class mastery</h2><p className="muted">Chapter and subject scores come directly from submitted question responses and the metadata stored on each test question.</p></div><span className="pill">{improving} improving</span></div><div className="settings-grid">{weakestChapter&&<div className="question-summary"><span className="eyebrow">LOWEST CHAPTER</span><h3>{weakestChapter.chapter}</h3><p className={masteryClass(Number(weakestChapter.mastery))}><b>{Number(weakestChapter.mastery).toFixed(0)}%</b> mastery · {weakestChapter.answered} responses</p></div>}{weakestSubject&&<div className="question-summary"><span className="eyebrow">LOWEST SUBJECT</span><h3>{weakestSubject.subject||weakestSubject.area}</h3><p className={masteryClass(Number(weakestSubject.mastery))}><b>{Number(weakestSubject.mastery).toFixed(0)}%</b> mastery · {weakestSubject.answered} responses</p></div>}</div>{canRemediate&&<div className="notice"><b>Turn analysis into the next test</b><p className="muted">CramLoop can create a short editable draft using questions from this test that match the weakest chapters and subjects. Questions matching both are prioritized.</p><form action={buildClassRemediation.bind(null,id)}><button>Build targeted remediation</button></form></div>}</section>}

  {chapters.length>0&&<section className="card"><h2>Chapter mastery</h2><p className="muted">Use this to see which units need reteaching or another focused assessment.</p><div className="stack">{chapters.map((a:any)=><div className="row between question-summary" key={`${a.chapter_number??''}-${a.chapter_title??''}`}><span><b>{a.chapter}</b><span className="muted"> · {a.answered} responses</span></span><b className={masteryClass(Number(a.mastery))}>{Number(a.mastery).toFixed(0)}%</b></div>)}</div></section>}

  {subjects.length>0&&<section className="card"><h2>Subject mastery</h2><p className="muted">Subject/category performance can span chapters, making it easier to spot recurring concept weaknesses.</p><div className="stack">{subjects.map((a:any)=><div className="row between question-summary" key={a.subject||a.area}><span><b>{a.subject||a.area}</b><span className="muted"> · {a.answered} responses</span></span><b className={masteryClass(Number(a.mastery))}>{Number(a.mastery).toFixed(0)}%</b></div>)}</div></section>}

  {studentProgress.length>0&&<section className="card"><div className="row between"><div><h2 style={{marginBottom:4}}>Who needs attention</h2><p className="muted">Prioritized by latest score plus weak recent chapter or subject mastery.</p></div><span className="pill">{needsHelp} flagged</span></div><div className="stack">{studentProgress.map((s:any)=><div className="question-summary" key={s.student_id}><div className="row between"><div><b>{s.student_name}</b><p className="muted">{s.attempt_count} attempt{s.attempt_count===1?'':'s'} · {trendLabel(s.trend)}</p></div><div><b>{Number(s.latest_score).toFixed(0)}%</b>{s.attempt_count>1&&<p className={Number(s.change)>0?'good':Number(s.change)<0?'bad':'muted'}>{Number(s.change)>0?'+':''}{Number(s.change).toFixed(0)} pts</p>}</div></div><div className="row" style={{gap:16,flexWrap:'wrap'}}>{s.weakest_chapter&&<p><b>Weak chapter:</b> {s.weakest_chapter} <span className="muted">· {Number(s.weakest_chapter_mastery||0).toFixed(0)}%</span></p>}{s.weakest_subject&&<p><b>Weak subject:</b> {s.weakest_subject} <span className="muted">· {Number(s.weakest_subject_mastery||0).toFixed(0)}%</span></p>}</div>{s.needs_help&&<p className="bad"><b>Teacher attention recommended</b></p>}</div>)}</div></section>}

  {rows.size===0?<section className="card"><p className="muted">No submitted attempts yet.</p></section>:[...rows.entries()].map(([studentId,row])=>{const progress:any=progressByStudent.get(studentId);return <section className="card" key={studentId}><div className="row between"><div><h2>{row.name}</h2><p className="muted">{row.attempts.length} completed attempt{row.attempts.length===1?'':'s'}{progress?` · ${trendLabel(progress.trend)}`:''}</p></div><strong>Highest grade: {row.best}%</strong></div>{progress&&<div className="grid three pass-stats"><div><span className="muted">First</span><b>{Number(progress.first_score).toFixed(0)}%</b></div><div><span className="muted">Latest</span><b>{Number(progress.latest_score).toFixed(0)}%</b></div><div><span className="muted">Change</span><b>{Number(progress.change)>0?'+':''}{Number(progress.change).toFixed(0)} pts</b></div></div>}{progress?.weakest_chapter&&<p className="muted">Weak chapter: <b>{progress.weakest_chapter}</b> ({Number(progress.weakest_chapter_mastery||0).toFixed(0)}%)</p>}{progress?.weakest_subject&&<p className="muted">Weak subject: <b>{progress.weakest_subject}</b> ({Number(progress.weakest_subject_mastery||0).toFixed(0)}%)</p>}{row.attempts.sort((a:any,b:any)=>a.attempt_number-b.attempt_number).map((a:any)=><div className="result-row" key={a.id}><div><b>Attempt {a.attempt_number}</b><p className="muted">{new Date(a.submitted_at).toLocaleString()}{a.auto_submitted?' · Auto-submitted':''}</p></div><div><b>{a.score_percent}%</b><p className="muted">{a.correct_count}/{a.total_questions} correct · {a.integrity_violation_count} integrity event(s)</p></div><Link href={`/attempts/${a.id}`}>Attempt details →</Link></div>)}</section>})}
 </main>
}
