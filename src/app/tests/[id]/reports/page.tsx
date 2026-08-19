import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'

type Row={name:string;best:number;attempts:any[]}

function trendLabel(value:string){
 if(value==='improving')return 'Improving'
 if(value==='slipping')return 'Slipping'
 if(value==='steady')return 'Steady'
 return 'Baseline'
}

export default async function TestReports({params}:{params:Promise<{id:string}>}){
 const{id}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const{data:test}=await supabase.from('tests').select('id,teacher_id,title,passing_score_percent').eq('id',id).single();if(!test||test.teacher_id!==user.id)notFound()
 const[{data:attempts},{data:mastery}]=await Promise.all([
  supabase.from('attempts').select('id,student_id,attempt_number,score_percent,correct_count,total_questions,started_at,submitted_at,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,student:profiles!attempts_student_id_fkey(full_name)').eq('test_id',id).not('submitted_at','is',null).order('submitted_at',{ascending:false}),
  supabase.rpc('get_teacher_test_mastery_report',{p_test_id:id})
 ])
 const rows=new Map<string,Row>();for(const a of attempts??[]){const s=Array.isArray((a as any).student)?(a as any).student[0]:(a as any).student;const key=String((a as any).student_id);const row:Row=rows.get(key)??{name:s?.full_name||'Student',best:0,attempts:[]};row.best=Math.max(row.best,Number((a as any).score_percent||0));row.attempts.push(a as any);rows.set(key,row)}
 const completed=attempts??[];const avg=completed.length?Math.round(completed.reduce((sum:number,a:any)=>sum+Number(a.score_percent||0),0)/completed.length):0;const passCount=completed.filter((a:any)=>Number(a.score_percent||0)>=Number(test.passing_score_percent||70)).length
 const studentProgress=Array.isArray(mastery?.students)?mastery.students:[]
 const areas=Array.isArray(mastery?.areas)?mastery.areas:[]
 const needsHelp=Number(mastery?.needs_help_count||0)
 const improving=Number(mastery?.improving_count||0)
 const progressByStudent=new Map(studentProgress.map((s:any)=>[String(s.student_id),s]))
 const weakestClassArea=areas[0]
 return <main>
  <div className="row between"><div><Link href="/dashboard">← Test library</Link><h1>{test.title} reports</h1><p className="muted">See scores, mastery, weak areas, and whether students are improving across attempts.</p></div><Link className="secondary button" href={`/tests/${id}/preview`}>Student view</Link></div>
  <div className="settings-grid"><section className="card"><b>{completed.length}</b><p className="muted">Completed attempts</p></section><section className="card"><b>{avg}%</b><p className="muted">Average score</p></section><section className="card"><b>{passCount}</b><p className="muted">Passing attempts</p></section><section className="card"><b>{needsHelp}</b><p className="muted">Students needing help</p></section></div>
  {studentProgress.length>0&&<section className="card"><div className="row between"><div><h2 style={{marginBottom:4}}>Class mastery</h2><p className="muted">Uses submitted question responses and each question's content area.</p></div><span className="pill">{improving} improving</span></div>{weakestClassArea&&<p><b>Class-wide focus: {weakestClassArea.area}</b> <span className="muted">· {Number(weakestClassArea.mastery).toFixed(0)}% mastery across {weakestClassArea.answered} responses</span></p>}<div className="stack">{areas.map((a:any)=><div className="row between question-summary" key={a.area}><span><b>{a.area}</b><span className="muted"> · {a.answered} responses</span></span><b>{Number(a.mastery).toFixed(0)}%</b></div>)}</div></section>}
  {studentProgress.length>0&&<section className="card"><div className="row between"><div><h2 style={{marginBottom:4}}>Who needs attention</h2><p className="muted">Prioritized by low latest score or weak recent content-area mastery.</p></div><span className="pill">{needsHelp} flagged</span></div><div className="stack">{studentProgress.map((s:any)=><div className="question-summary" key={s.student_id}><div className="row between"><div><b>{s.student_name}</b><p className="muted">{s.attempt_count} attempt{s.attempt_count===1?'':'s'} · {trendLabel(s.trend)}</p></div><div><b>{Number(s.latest_score).toFixed(0)}%</b>{s.attempt_count>1&&<p className={Number(s.change)>0?'good':Number(s.change)<0?'bad':'muted'}>{Number(s.change)>0?'+':''}{Number(s.change).toFixed(0)} pts</p>}</div></div>{s.weakest_area&&<p><b>Needs work: {s.weakest_area}</b> <span className="muted">· {Number(s.weakest_mastery||0).toFixed(0)}% recent mastery</span></p>}{s.needs_help&&<p className="bad"><b>Teacher attention recommended</b></p>}</div>)}</div></section>}
  {rows.size===0?<section className="card"><p className="muted">No submitted attempts yet.</p></section>:[...rows.entries()].map(([studentId,row])=>{const progress:any=progressByStudent.get(studentId);return <section className="card" key={studentId}><div className="row between"><div><h2>{row.name}</h2><p className="muted">{row.attempts.length} completed attempt{row.attempts.length===1?'':'s'}{progress?` · ${trendLabel(progress.trend)}`:''}</p></div><strong>Highest grade: {row.best}%</strong></div>{progress&&<div className="grid three pass-stats"><div><span className="muted">First</span><b>{Number(progress.first_score).toFixed(0)}%</b></div><div><span className="muted">Latest</span><b>{Number(progress.latest_score).toFixed(0)}%</b></div><div><span className="muted">Change</span><b>{Number(progress.change)>0?'+':''}{Number(progress.change).toFixed(0)} pts</b></div></div>}{progress?.weakest_area&&<p className="muted">Current weak area: <b>{progress.weakest_area}</b> ({Number(progress.weakest_mastery||0).toFixed(0)}%)</p>}{row.attempts.sort((a:any,b:any)=>a.attempt_number-b.attempt_number).map((a:any)=><div className="result-row" key={a.id}><div><b>Attempt {a.attempt_number}</b><p className="muted">{new Date(a.submitted_at).toLocaleString()}{a.auto_submitted?' · Auto-submitted':''}</p></div><div><b>{a.score_percent}%</b><p className="muted">{a.correct_count}/{a.total_questions} correct · {a.integrity_violation_count} integrity event(s)</p></div><Link href={`/attempts/${a.id}`}>Attempt details →</Link></div>)}</section>})}
 </main>
}
