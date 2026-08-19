import Link from 'next/link'
import styles from './studentAssignments.module.css'

type Assignment={
  assignment_key:string;test_id:string;share_id:string|null;title:string;assignment_label:string|null;teacher_name:string;teacher_organization:string|null;teacher_title:string|null;experience_name:string|null;due_at:string|null;assigned_at:string|null;href:string;access_label:string;passing_score_percent:number;max_attempts:number|null;unlimited_attempts_until_due:boolean;focused_retake_enabled:boolean;require_focused_retake_before_full:boolean;focused_retake_min_score:number;randomized_retest_enabled:boolean
}
type Attempt={id:string;test_id:string;share_id:string|null;score_percent:number|null;submitted_at:string|null;started_at:string;attempt_number:number}
type Practice={id:string;status:string;score_percent:number|null;source_attempt_id:string|null;source_share_id:string|null;created_at:string}

function appendFresh(href:string){return `${href}${href.includes('?')?'&':'?'}fresh=1`}
function pct(value:number|null|undefined){return value==null?null:Math.round(Number(value))}

export default function StudentAssignments({assignments,attempts,practiceSessions}:{assignments:Assignment[];attempts:Attempt[];practiceSessions:Practice[]}){
  const now=Date.now()
  const cards=assignments.map(a=>{
    const related=attempts.filter(x=>a.share_id?x.share_id===a.share_id:!x.share_id&&x.test_id===a.test_id).sort((x,y)=>new Date(y.started_at).getTime()-new Date(x.started_at).getTime())
    const active=related.find(x=>!x.submitted_at)
    const submitted=related.filter(x=>x.submitted_at)
    const highest=submitted.length?Math.max(...submitted.map(x=>Number(x.score_percent??0))):null
    const passed=highest!=null&&highest>=Number(a.passing_score_percent??70)
    const latestSubmitted=submitted[0]
    const dueMs=a.due_at?new Date(a.due_at).getTime():null
    const pastDue=dueMs!=null&&dueMs<=now
    const dueSoon=dueMs!=null&&!pastDue&&dueMs-now<=48*60*60*1000
    const attemptsUsed=submitted.length+(active?1:0)
    const canTryAgain=!pastDue&&(a.unlimited_attempts_until_due||a.max_attempts==null||attemptsUsed<Number(a.max_attempts))
    const latestFailed=latestSubmitted&&Number(latestSubmitted.score_percent??0)<Number(a.passing_score_percent??70)?latestSubmitted:null
    const focusedForLatest=latestFailed?practiceSessions.filter(p=>p.source_attempt_id===latestFailed.id).sort((x,y)=>new Date(y.created_at).getTime()-new Date(x.created_at).getTime()):[]
    const activeFocus=focusedForLatest.find(p=>p.status==='active')
    const focusedGateMet=focusedForLatest.some(p=>p.status==='submitted'&&Number(p.score_percent??0)>=Number(a.focused_retake_min_score??0))

    let status='Not started',actionLabel='Start assignment',actionHref=a.href,tone='neutral'
    if(active){status='In progress';actionLabel='Continue test';actionHref=a.href;tone='active'}
    else if(passed){status='Complete';actionLabel='View results';actionHref=`/attempts/${latestSubmitted?.id}`;tone='complete'}
    else if(latestFailed&&a.require_focused_retake_before_full&&!focusedGateMet){status='Focused retest required';tone='focus';if(activeFocus){actionLabel='Continue focused retest';actionHref=`/practice/${activeFocus.id}`}else{actionLabel='Start focused retest';actionHref=`/attempts/${latestFailed.id}#focused-retest`}}
    else if(latestFailed&&canTryAgain&&a.randomized_retest_enabled){status='Ready for full retest';actionLabel='Start full retest';actionHref=appendFresh(a.href);tone='ready'}
    else if(latestSubmitted){status='Complete';actionLabel='View results';actionHref=`/attempts/${latestSubmitted.id}`;tone='complete'}
    if(pastDue&&!passed&&!activeFocus){actionLabel=latestSubmitted?'View results':'View assignment';actionHref=latestSubmitted?`/attempts/${latestSubmitted.id}`:a.href}

    return {...a,status,actionLabel,actionHref,tone,highest,attemptsUsed,pastDue,dueSoon,sortRank:status==='Complete'?2:pastDue?1:0}
  }).sort((a,b)=>a.sortRank-b.sortRank||new Date(b.assigned_at??0).getTime()-new Date(a.assigned_at??0).getTime())

  const activeCards=cards.filter(c=>c.status!=='Complete')
  const completeCards=cards.filter(c=>c.status==='Complete')
  const renderCard=(a:typeof cards[number])=><section className={`${styles.card} ${styles[a.tone]??''}`} key={a.assignment_key}>
    <div className={styles.top}><div className={styles.titleBlock}><span className={styles.status}>{a.status}</span><h3>{a.assignment_label||a.title}</h3>{a.assignment_label&&<p>{a.title}</p>}</div>{a.highest!=null&&<div className={styles.grade}><span>Highest</span><b>{pct(a.highest)}%</b></div>}</div>
    <div className={styles.meta}><span>{a.teacher_name}{(a.teacher_organization||a.teacher_title)?` · ${[a.teacher_organization,a.teacher_title].filter(Boolean).join(' ')}`:''}</span><span>{a.experience_name||a.access_label}</span></div>
    <div className={styles.due}>{a.pastDue?<b>Past due</b>:a.dueSoon?<b>Due soon</b>:null}<span>{a.due_at?`Due ${new Date(a.due_at).toLocaleString()}`:'No due date'}</span>{a.attemptsUsed>0&&<span>{a.attemptsUsed} attempt{a.attemptsUsed===1?'':'s'} started</span>}</div>
    <Link className={`button ${styles.action}`} href={a.actionHref}>{a.actionLabel}</Link>
  </section>

  if(!cards.length)return <div className="card"><p className="muted">No active assignments yet.</p></div>
  return <div className={styles.wrap}>{activeCards.map(renderCard)}{completeCards.length>0&&<details className={styles.completed}><summary>Completed assignments <span>{completeCards.length}</span></summary><div className={styles.completedList}>{completeCards.map(renderCard)}</div></details>}</div>
}
