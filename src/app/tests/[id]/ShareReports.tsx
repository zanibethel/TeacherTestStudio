import Link from 'next/link'

type ShareRow={
  id:string;token:string;label:string|null;delivery_mode:string|null;restricted_mode:boolean|null;audience_mode:string|null;access_mode:string|null;payment_mode:string|null;max_attempts:number|null;unlimited_attempts_until_due:boolean|null;due_at:string|null;require_focused_retake_before_full:boolean|null;focused_retake_percent:number|null;focused_retake_min_score:number|null;focused_retake_hints:boolean|null;access_duration_days:number|null;study_guide_enabled:boolean|null;focused_retake_enabled:boolean|null;randomized_retest_enabled:boolean|null;link_expires_at:string|null;price_cents:number|null;active:boolean|null;created_at:string
}
type AttemptRow={id:string;share_id:string|null;score_percent:number|null;correct_count:number|null;total_questions:number|null;submitted_at:string|null;student_id:string|null;attempt_number:number|null;integrity_violation_count:number|null;auto_submitted:boolean|null;student:any}

type StudentAttempts={name:string;attempts:AttemptRow[]}

function studentName(attempt:AttemptRow){const student=Array.isArray(attempt.student)?attempt.student[0]:attempt.student;return student?.full_name||'Student'}
function fmt(value:string|null){return value?new Date(value).toLocaleString():'None'}

export default function ShareReports({testTitle,shares,attempts}:{testTitle:string;shares:ShareRow[];attempts:AttemptRow[]}){
  return <section className="card assignment-reports">
    <div className="row between"><div><h2>Assignment reports</h2><p className="muted">Each share is reported separately so the same reusable test can be compared across classes, dates, and retake policies.</p></div><span className="pill">{shares.length} assignment{shares.length===1?'':'s'}</span></div>
    {shares.length===0?<p className="muted">No assignments have been shared yet.</p>:shares.map(share=>{
      const shareAttempts=attempts.filter(a=>a.share_id===share.id)
      const accessedIds=new Set(shareAttempts.map(a=>a.student_id).filter(Boolean))
      const completedAttempts=shareAttempts.filter(a=>Boolean(a.submitted_at))
      const completedIds=new Set(completedAttempts.map(a=>a.student_id).filter(Boolean))
      const byStudent=new Map<string,StudentAttempts>()
      for(const attempt of shareAttempts){const key=String(attempt.student_id||attempt.id);const current:StudentAttempts=byStudent.get(key)??{name:studentName(attempt),attempts:[]};current.attempts.push(attempt);byStudent.set(key,current)}
      const mode=share.delivery_mode==='paid_pass'?'Paid practice access':share.delivery_mode==='study'?'Study mode':share.delivery_mode==='restricted'?'Restricted Test Mode':'Standard test'
      const audience=share.audience_mode==='students'?'Specific roster students':share.audience_mode==='groups'?'Specific groups':'Anyone with the share link'
      const attemptsPolicy=share.payment_mode==='paid'?'Practice access':share.unlimited_attempts_until_due?'Unlimited full attempts until due date':`${share.max_attempts||1} full attempt${(share.max_attempts||1)===1?'':'s'}`
      const focusedPolicy=share.require_focused_retake_before_full?`Required after a failed full attempt · ${share.focused_retake_percent??50}% of full test · ${share.focused_retake_min_score??0}% to unlock next full attempt`:share.focused_retake_enabled?'Optional weak-area retakes allowed':'No focused retake path'
      return <details className="assignment-report" key={share.id}>
        <summary>
          <div className="assignment-report-heading"><div><span className="eyebrow">{share.label||'Untitled assignment'}</span><h3>{testTitle}</h3></div><span className="pill">{share.active?'Active':'Disabled'}</span></div>
          <div className="assignment-report-stats">
            <div><span>Assigned</span><b>{new Date(share.created_at).toLocaleDateString()}</b></div>
            <div><span>Due</span><b>{share.due_at?new Date(share.due_at).toLocaleDateString():'No due date'}</b></div>
            <div><span>Student access</span><b>{accessedIds.size}</b></div>
            <div><span>Students complete</span><b>{completedIds.size}</b></div>
          </div>
        </summary>
        <div className="assignment-report-body">
          <div className="grid two assignment-report-meta">
            <section><h3>Share parameters</h3><p><b>Assigned:</b> {fmt(share.created_at)}</p><p><b>Due:</b> {fmt(share.due_at)}</p><p><b>Audience:</b> {audience}</p><p><b>Testing experience:</b> {mode}</p><p><b>Full attempts:</b> {attemptsPolicy}</p><p><b>Focused retake:</b> {focusedPolicy}</p><p><b>Focused hints:</b> {share.focused_retake_hints?'On':'Off'}</p><p><b>Study guide:</b> {share.study_guide_enabled?'On':'Off'}</p><p><b>Fresh randomized full retest:</b> {share.randomized_retest_enabled?'On':'Off'}</p><p><b>Integrity monitoring:</b> {share.restricted_mode?'On':'Off'}</p><p><b>Share-link expiration:</b> {fmt(share.link_expires_at)}</p>{share.payment_mode==='paid'&&<p><b>Paid access:</b> ${((share.price_cents||0)/100).toFixed(2)} · {share.access_duration_days||14} days</p>}</section>
            <section><h3>Assignment activity</h3><p><b>{accessedIds.size}</b> unique student{accessedIds.size===1?' has':'s have'} started this assignment.</p><p><b>{completedIds.size}</b> unique student{completedIds.size===1?' has':'s have'} submitted at least one full attempt.</p><p className="muted">Retakes do not inflate these student counts. Every submitted attempt is still retained below.</p><p><a href={`https://cramloop.app/share/${share.token}`}>Open share link →</a></p></section>
          </div>
          <h3>Student results</h3>
          {byStudent.size===0?<p className="muted">No students have accessed this assignment yet.</p>:[...byStudent.entries()].map(([studentId,row])=>{const submitted=row.attempts.filter(a=>a.submitted_at).sort((a,b)=>(a.attempt_number||0)-(b.attempt_number||0));const best=submitted.length?Math.max(...submitted.map(a=>Number(a.score_percent||0))):null;return <div className="assignment-student" key={studentId}><div className="row between"><div><b>{row.name}</b><p className="muted">{submitted.length?`${submitted.length} completed attempt${submitted.length===1?'':'s'}`:'Accessed · not yet completed'}</p></div>{best!==null&&<b>Highest grade: {best}%</b>}</div>{submitted.map(a=><div className="result-row" key={a.id}><div><b>Attempt {a.attempt_number||1}</b><p className="muted">{new Date(a.submitted_at!).toLocaleString()}{a.auto_submitted?' · Auto-submitted':''}</p></div><div><b>{a.score_percent}%</b><p className="muted">{a.correct_count}/{a.total_questions} correct · {a.integrity_violation_count||0} integrity event(s)</p></div><Link href={`/attempts/${a.id}`}>Attempt details</Link></div>)}</div>})}
        </div>
      </details>
    })}
  </section>
}
