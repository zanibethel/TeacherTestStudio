import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createShareOffer, saveDeliveryControls, setShareActive, setTestStatus } from './actions'

function localInput(value:string|null){if(!value)return'';const d=new Date(value);const pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}

export default async function TestDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:test}=await supabase.from('tests').select('id,title,description,status,share_code,randomize_questions,randomize_choices,teacher_id,assignment_mode,max_attempts,allow_save_resume,study_guide_enabled,strict_mode,integrity_action,integrity_limit,review_mode,available_from,due_at,questions(id,prompt,position,choices(id,label,position)),attempts(id,score_percent,correct_count,total_questions,submitted_at,student_id,attempt_number,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,student:profiles!attempts_student_id_fkey(full_name))').eq('id',id).single()
  if(!test||test.teacher_id!==user.id)notFound()
  const{data:students}=await supabase.from('profiles').select('id,full_name').eq('role','student').order('full_name')
  const{data:assigned}=await supabase.from('test_assignments').select('student_id').eq('test_id',id)
  const{data:shares}=await supabase.from('test_shares').select('id,token,label,access_mode,payment_mode,max_attempts,access_duration_days,study_guide_enabled,link_expires_at,price_cents,active,created_at').eq('test_id',id).order('created_at',{ascending:false})
  const assignedIds=new Set((assigned??[]).map((a:any)=>a.student_id));const query=await searchParams
  const questions=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position);const attempts=[...(test.attempts??[])].sort((a:any,b:any)=>String(b.submitted_at).localeCompare(String(a.submitted_at)))
  const shareUrl=`https://teacher-test-studio.vercel.app/take/${id}`
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>{test.title}</h1><p className="muted">{test.description||'No description'}</p></div><span className="pill">{test.status}</span></div>
    {query.error&&<p className="bad">{query.error}</p>}
    <section className="card"><h2>Publish</h2><p>Legacy classroom code: <b className="code">{test.share_code}</b></p><p><a href={shareUrl}>{shareUrl}</a></p><p className="muted">The legacy link uses the classroom controls below. New share offers let you reuse this same test with different attempt limits, pass lengths, and study-guide settings.</p><p>Question order: <b>{test.randomize_questions?'Randomized':'Fixed'}</b></p><form action={setTestStatus.bind(null,id,test.status==='published'?'draft':'published')}><button>{test.status==='published'?'Unpublish test':'Publish test'}</button></form></section>

    <section className="card stack"><div><h2>Create a share offer</h2><p className="muted">One test can have multiple share links. Each link keeps its own access rules.</p></div>
      <form action={createShareOffer.bind(null,id)} className="stack">
        <label>Share label</label><input name="label" placeholder="Week 1 classroom quiz or 14-day PSI practice pass"/>
        <div className="settings-grid"><div><label>Access type</label><select name="access_mode" defaultValue="classroom"><option value="classroom">Classroom share</option><option value="practice_pass">Timed practice pass</option></select></div><div><label>Payment</label><select name="payment_mode" defaultValue="free"><option value="free">Free</option><option value="paid">Paid practice pass</option></select></div></div>
        <div className="settings-grid"><div><label>Attempts allowed</label><input name="max_attempts" type="number" min="1" max="100" defaultValue="1"/><label className="check"><input type="checkbox" name="unlimited_attempts"/>Unlimited attempts</label></div><div><label>Pass duration (days)</label><input name="access_duration_days" type="number" min="1" max="365" defaultValue="14"/><p className="muted">For practice passes, the clock starts on the student's first activation.</p></div></div>
        <div className="settings-grid"><div><label>Link itself expires</label><input name="link_expires_at" type="datetime-local"/><p className="muted">Optional. Leave blank to keep the link available.</p></div><div><label>Paid pass price</label><input name="price_dollars" type="number" min="1" step="0.01" placeholder="12.99"/><p className="muted">Paid links stay locked until payment checkout is connected.</p></div></div>
        <label className="check"><input name="study_guide_enabled" type="checkbox" defaultChecked/><b>Study guide after a failed attempt</b> — on by default</label>
        <button>Create share link</button>
      </form>
    </section>

    {(shares??[]).length>0&&<section className="card"><h2>Share links</h2>{(shares??[]).map((s:any)=>{const url=`https://teacher-test-studio.vercel.app/share/${s.token}`;return <div className="question-summary" key={s.id}><div className="row between"><div><b>{s.label||'Untitled share'}</b><p><a href={url}>{url}</a></p><p className="muted">{s.payment_mode==='paid'?`Paid · $${((s.price_cents||0)/100).toFixed(2)}`:'Free'} · {s.access_mode==='practice_pass'?(s.access_duration_days?`${s.access_duration_days}-day pass`:'Practice pass'):'Classroom'} · {s.max_attempts==null?'Unlimited attempts':`${s.max_attempts} attempt${s.max_attempts===1?'':'s'}`} · Study guide {s.study_guide_enabled?'on':'off'}{s.link_expires_at?` · Link closes ${new Date(s.link_expires_at).toLocaleString()}`:''}</p></div><span className="pill">{s.active?'Active':'Disabled'}</span></div><form action={setShareActive.bind(null,id,s.id,!s.active)}><button className="secondary">{s.active?'Disable link':'Enable link'}</button></form></div>})}</section>}

    <form action={saveDeliveryControls.bind(null,id)} className="card stack"><h2>Legacy classroom access & test controls</h2>
      <label>Who can take this test?</label><select name="assignment_mode" defaultValue={test.assignment_mode}><option value="link">Anyone with the code/link</option><option value="assigned">Only assigned students</option></select>
      <label>Assign students</label><div className="stack">{!students?.length?<p className="muted">Student accounts will appear here after they sign up.</p>:students.map((s:any)=><label className="check" key={s.id}><input type="checkbox" name="student_ids" value={s.id} defaultChecked={assignedIds.has(s.id)}/>{s.full_name||'Student'}</label>)}</div>
      <div className="settings-grid"><div><label>Attempts allowed</label><input name="max_attempts" type="number" min="1" max="20" defaultValue={test.max_attempts}/></div><div><label>Review answers</label><select name="review_mode" defaultValue={test.review_mode}><option value="immediate">Immediately after submission</option><option value="after_due">After due date</option><option value="never">Score only — no answer review</option></select></div></div>
      <div className="settings-grid"><div><label>Available from</label><input name="available_from" type="datetime-local" defaultValue={localInput(test.available_from)}/></div><div><label>Due / closes</label><input name="due_at" type="datetime-local" defaultValue={localInput(test.due_at)}/></div></div>
      <label className="check"><input name="study_guide_enabled" type="checkbox" defaultChecked={test.study_guide_enabled}/><b>Study guide after a failed attempt</b></label>
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
