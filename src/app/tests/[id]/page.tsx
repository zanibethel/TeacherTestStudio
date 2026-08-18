import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveDeliveryControls, setTestStatus } from './actions'

function localInput(value:string|null){if(!value)return'';const d=new Date(value);const pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}

export default async function TestDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:test}=await supabase.from('tests').select('id,title,description,status,share_code,randomize_questions,randomize_choices,teacher_id,assignment_mode,max_attempts,allow_save_resume,strict_mode,integrity_action,integrity_limit,review_mode,available_from,due_at,questions(id,prompt,position,choices(id,label,position)),attempts(id,score_percent,correct_count,total_questions,submitted_at,student_id,attempt_number,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,student:profiles!attempts_student_id_fkey(full_name))').eq('id',id).single()
  if(!test||test.teacher_id!==user.id)notFound()
  const{data:students}=await supabase.from('profiles').select('id,full_name').eq('role','student').order('full_name')
  const{data:assigned}=await supabase.from('test_assignments').select('student_id').eq('test_id',id)
  const assignedIds=new Set((assigned??[]).map((a:any)=>a.student_id));const query=await searchParams
  const questions=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position);const attempts=[...(test.attempts??[])].sort((a:any,b:any)=>String(b.submitted_at).localeCompare(String(a.submitted_at)))
  const shareUrl=`https://teacher-test-studio.vercel.app/take/${id}`
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>{test.title}</h1><p className="muted">{test.description||'No description'}</p></div><span className="pill">{test.status}</span></div>
    {query.error&&<p className="bad">{query.error}</p>}
    <section className="card"><h2>Publish & share</h2><p>Student code: <b className="code">{test.share_code}</b></p><p><a href={shareUrl}>{shareUrl}</a></p><p>Question order: <b>{test.randomize_questions?'Randomized':'Fixed'}</b></p><form action={setTestStatus.bind(null,id,test.status==='published'?'draft':'published')}><button>{test.status==='published'?'Unpublish test':'Publish test'}</button></form></section>

    <form action={saveDeliveryControls.bind(null,id)} className="card stack"><h2>Student access & test controls</h2>
      <label>Who can take this test?</label><select name="assignment_mode" defaultValue={test.assignment_mode}><option value="link">Anyone with the code/link</option><option value="assigned">Only assigned students</option></select>
      <label>Assign students</label><div className="stack">{!students?.length?<p className="muted">Student accounts will appear here after they sign up.</p>:students.map((s:any)=><label className="check" key={s.id}><input type="checkbox" name="student_ids" value={s.id} defaultChecked={assignedIds.has(s.id)}/>{s.full_name||'Student'}</label>)}</div>
      <div className="settings-grid"><div><label>Attempts allowed</label><input name="max_attempts" type="number" min="1" max="20" defaultValue={test.max_attempts}/></div><div><label>Review answers</label><select name="review_mode" defaultValue={test.review_mode}><option value="immediate">Immediately after submission</option><option value="after_due">After due date</option><option value="never">Score only — no answer review</option></select></div></div>
      <div className="settings-grid"><div><label>Available from</label><input name="available_from" type="datetime-local" defaultValue={localInput(test.available_from)}/></div><div><label>Due / closes</label><input name="due_at" type="datetime-local" defaultValue={localInput(test.due_at)}/></div></div>
      <label className="check"><input name="allow_save_resume" type="checkbox" defaultChecked={test.allow_save_resume}/>Allow students to save and resume an in-progress attempt</label>
      <label className="check"><input name="randomize_choices" type="checkbox" defaultChecked={test.randomize_choices}/>Randomize answer-choice order</label>
      <hr/><label className="check"><input name="strict_mode" type="checkbox" defaultChecked={test.strict_mode}/><b>Strict Test Mode</b> — fullscreen plus tab/app, copy/paste, right-click and fullscreen-exit monitoring</label>
      <div className="settings-grid"><div><label>When an integrity event occurs</label><select name="integrity_action" defaultValue={test.integrity_action}><option value="flag">Record it silently for teacher review</option><option value="warn">Record it and warn the student</option><option value="auto_submit">Auto-submit after the limit</option></select></div><div><label>Auto-submit violation limit</label><input name="integrity_limit" type="number" min="1" max="20" defaultValue={test.integrity_limit}/></div></div>
      <p className="muted">Strict Mode discourages browser-based cheating, but no normal website can prevent a student from using a separate device.</p><button>Save test controls</button>
    </form>

    <section className="card"><h2>Questions ({questions.length})</h2>{questions.map((q:any)=><div className="question-summary" key={q.id}><b>{q.position}. {q.prompt}</b><p className="muted">{q.choices?.length??0} choices</p></div>)}</section>
    <section className="card"><h2>Student results ({attempts.length})</h2>{attempts.length===0?<p className="muted">No attempts yet.</p>:attempts.map((a:any)=>{const student=Array.isArray(a.student)?a.student[0]:a.student;return <div className="result-row" key={a.id}><div><b>{student?.full_name||'Student'} · Attempt {a.attempt_number}</b><p className="muted">{a.submitted_at?new Date(a.submitted_at).toLocaleString():'In progress'}{a.auto_submitted?' · Auto-submitted':''}</p></div><div><b>{a.score_percent}%</b><p className="muted">{a.correct_count}/{a.total_questions} correct · {a.integrity_violation_count} integrity event(s)</p></div><Link href={`/attempts/${a.id}`}>Review</Link></div>})}</section>
  </main>
}
