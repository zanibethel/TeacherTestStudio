import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import './progress.css'

type AnyRow=Record<string,any>

function rosterName(r:AnyRow){return [r.student_first_name,r.student_last_name].filter(Boolean).join(' ').trim()||r.student_email||'Student'}
function pct(v:any){return v==null?null:Math.round(Number(v))}

export default async function TeacherProgress({searchParams}:{searchParams:Promise<{group?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const[{data:groups},{data:roster},{data:shares}]=await Promise.all([
    supabase.from('teacher_groups').select('id,name').eq('teacher_id',user.id).order('name'),
    supabase.from('teacher_student_roster').select('id,student_id,student_email,student_first_name,student_last_name').eq('teacher_id',user.id).order('student_last_name'),
    supabase.from('test_shares').select('id,test_id,label,experience_name,created_at,due_at,audience_mode,max_attempts,unlimited_attempts_until_due,require_focused_retake_before_full,focused_retake_min_score,randomized_retest_enabled,test:tests(id,title,passing_score_percent)').eq('teacher_id',user.id).order('created_at',{ascending:false})
  ])
  const shareIds=(shares??[]).map((s:AnyRow)=>s.id)
  const groupIds=(groups??[]).map((g:AnyRow)=>g.id)
  const[{data:members},{data:groupTargets},{data:rosterTargets},{data:attempts},{data:practice}]=await Promise.all([
    groupIds.length?supabase.from('teacher_group_members').select('group_id,roster_id').in('group_id',groupIds):Promise.resolve({data:[] as AnyRow[]}),
    shareIds.length?supabase.from('test_share_group_targets').select('share_id,group_id').in('share_id',shareIds):Promise.resolve({data:[] as AnyRow[]}),
    shareIds.length?supabase.from('test_share_roster_targets').select('share_id,roster_id').in('share_id',shareIds):Promise.resolve({data:[] as AnyRow[]}),
    shareIds.length?supabase.from('attempts').select('id,share_id,student_id,started_at,submitted_at,score_percent,attempt_number').in('share_id',shareIds).order('started_at',{ascending:false}):Promise.resolve({data:[] as AnyRow[]}),
    supabase.rpc('get_teacher_practice_progress')
  ])

  const rosterById=new Map((roster??[]).map((r:AnyRow)=>[String(r.id),r]))
  const rosterByStudent=new Map((roster??[]).filter((r:AnyRow)=>r.student_id).map((r:AnyRow)=>[String(r.student_id),r]))
  const groupById=new Map((groups??[]).map((g:AnyRow)=>[String(g.id),g]))
  const membersByGroup=new Map<string,string[]>()
  for(const m of members??[]){const gid=String((m as AnyRow).group_id);membersByGroup.set(gid,[...(membersByGroup.get(gid)??[]),String((m as AnyRow).roster_id)])}
  const groupTargetsByShare=new Map<string,string[]>();for(const t of groupTargets??[]){const sid=String((t as AnyRow).share_id);groupTargetsByShare.set(sid,[...(groupTargetsByShare.get(sid)??[]),String((t as AnyRow).group_id)])}
  const rosterTargetsByShare=new Map<string,string[]>();for(const t of rosterTargets??[]){const sid=String((t as AnyRow).share_id);rosterTargetsByShare.set(sid,[...(rosterTargetsByShare.get(sid)??[]),String((t as AnyRow).roster_id)])}
  const attemptsByShare=new Map<string,AnyRow[]>();for(const a of attempts??[]){const sid=String((a as AnyRow).share_id);attemptsByShare.set(sid,[...(attemptsByShare.get(sid)??[]),a as AnyRow])}
  const practiceByAttempt=new Map<string,AnyRow[]>();for(const p of practice??[]){if(!(p as AnyRow).source_attempt_id)continue;const aid=String((p as AnyRow).source_attempt_id);practiceByAttempt.set(aid,[...(practiceByAttempt.get(aid)??[]),p as AnyRow])}

  const selectedGroup=query.group&&groupById.has(query.group)?query.group:''
  const now=Date.now()
  const assignmentCards=(shares??[]).flatMap((share:AnyRow)=>{
    const shareGroupIds=groupTargetsByShare.get(String(share.id))??[]
    if(selectedGroup&&!shareGroupIds.includes(selectedGroup))return []
    const assigned=new Set(rosterTargetsByShare.get(String(share.id))??[])
    for(const gid of shareGroupIds)for(const rid of membersByGroup.get(gid)??[])assigned.add(rid)
    if(!assigned.size)return []
    const test=Array.isArray(share.test)?share.test[0]:share.test
    const rows=[...assigned].map(rid=>{
      const r=rosterById.get(rid);if(!r)return null
      const related=(attemptsByShare.get(String(share.id))??[]).filter(a=>r.student_id&&String(a.student_id)===String(r.student_id))
      const active=related.find(a=>!a.submitted_at)
      const submitted=related.filter(a=>a.submitted_at)
      const highest=submitted.length?Math.max(...submitted.map(a=>Number(a.score_percent??0))):null
      const latest=submitted[0]
      const passing=Number(test?.passing_score_percent??70)
      const passed=highest!=null&&highest>=passing
      const focused=latest?practiceByAttempt.get(String(latest.id))??[]:[]
      const activeFocus=focused.find(p=>p.status==='active')
      const gateMet=focused.some(p=>p.status==='submitted'&&Number(p.score_percent??0)>=Number(share.focused_retake_min_score??0))
      const latestFailed=latest&&Number(latest.score_percent??0)<passing
      const dueMs=share.due_at?new Date(share.due_at).getTime():null
      const pastDue=dueMs!=null&&dueMs<=now
      let status='Not started',tone='neutral'
      if(active){status='In progress';tone='active'}
      else if(passed){status='Complete';tone='complete'}
      else if(latestFailed&&share.require_focused_retake_before_full&&!gateMet){status=activeFocus?'Focused retest in progress':'Focused retest required';tone='focus'}
      else if(latestFailed&&gateMet&&share.randomized_retest_enabled){status='Full retest unlocked';tone='ready'}
      else if(latestFailed){status=pastDue?'Needs review':'Needs another attempt';tone='warning'}
      const latestPractice=[...focused].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]
      return{r,status,tone,highest,attempts:submitted.length+(active?1:0),latest,weakAreas:(latestPractice?.selected_areas??[]) as string[]}
    }).filter(Boolean) as AnyRow[]
    const counts={notStarted:rows.filter(x=>x.status==='Not started').length,inProgress:rows.filter(x=>x.status==='In progress').length,focus:rows.filter(x=>String(x.status).startsWith('Focused')).length,ready:rows.filter(x=>x.status==='Full retest unlocked').length,complete:rows.filter(x=>x.status==='Complete').length}
    return[{share,test,rows,shareGroupIds,counts}]
  })

  const totals={students:(roster??[]).filter((r:AnyRow)=>r.student_id).length,notStarted:0,inProgress:0,focus:0,ready:0,complete:0}
  for(const a of assignmentCards){totals.notStarted+=a.counts.notStarted;totals.inProgress+=a.counts.inProgress;totals.focus+=a.counts.focus;totals.ready+=a.counts.ready;totals.complete+=a.counts.complete}

  return <main className="teacher-progress-page">
    <div className="row between progress-heading"><div><Link href="/dashboard">← Teacher dashboard</Link><h1>Student progress</h1><p className="muted">See who needs attention first, then expand an assignment or student only when you need more detail.</p></div><Link className="secondary button" href="/reports">All assignment reports</Link></div>

    <section className="progress-summary">
      <div><span>Connected students</span><b>{totals.students}</b></div><div><span>Not started</span><b>{totals.notStarted}</b></div><div><span>In progress</span><b>{totals.inProgress}</b></div><div><span>Focused retest</span><b>{totals.focus}</b></div><div><span>Full retest ready</span><b>{totals.ready}</b></div><div><span>Complete</span><b>{totals.complete}</b></div>
    </section>

    {(groups??[]).length>0&&<nav className="progress-group-filter" aria-label="Filter by class"><Link className={!selectedGroup?'active':''} href="/teacher-progress">All classes</Link>{(groups??[]).map((g:AnyRow)=><Link className={selectedGroup===String(g.id)?'active':''} key={g.id} href={`/teacher-progress?group=${g.id}`}>{g.name}</Link>)}</nav>}

    {!assignmentCards.length?<section className="card"><h2>No assigned class work yet</h2><p className="muted">Once you share a test to a group or selected student, progress will appear here automatically.</p></section>:assignmentCards.map(({share,test,rows,shareGroupIds,counts}:AnyRow)=><details className="card progress-assignment" key={share.id} open={assignmentCards.length===1}>
      <summary><div><span className="eyebrow">{share.experience_name||'Assignment'}</span><h2>{share.label||test?.title||'Assignment'}</h2>{share.label&&<p className="muted">{test?.title}</p>}<p className="muted">{shareGroupIds.map((id:string)=>groupById.get(id)?.name).filter(Boolean).join(', ')||'Selected students'} · {share.due_at?`Due ${new Date(share.due_at).toLocaleString()}`:'No due date'}</p></div><div className="progress-assignment-counts"><span>{counts.notStarted} not started</span><span>{counts.focus} remediation</span><span>{counts.complete} complete</span></div></summary>
      <div className="progress-student-list">{rows.map((x:AnyRow)=><details className={`progress-student ${x.tone}`} key={x.r.id}><summary><div><b>{rosterName(x.r)}</b><span>{x.r.student_email}</span></div><div className="progress-student-right">{x.highest!=null&&<strong>{pct(x.highest)}%</strong>}<span className="progress-status">{x.status}</span></div></summary><div className="progress-student-detail"><p><b>{x.attempts}</b> attempt{x.attempts===1?'':'s'} started{x.highest!=null?` · Highest grade ${pct(x.highest)}%`:''}</p>{x.weakAreas.length>0&&<div><b>Current weak areas</b><div className="progress-area-list">{x.weakAreas.slice(0,6).map((area:string)=><span className="pill" key={area}>{area}</span>)}</div></div>}<div className="row"><Link className="secondary button" href={`/reports?student=roster:${x.r.id}`}>Student reports</Link>{x.latest&&<Link className="secondary button" href={`/attempts/${x.latest.id}`}>Latest attempt</Link>}</div></div></details>)}</div>
    </details>)}
  </main>
}
