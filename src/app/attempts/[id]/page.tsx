import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {createFocusPractice} from '@/app/practice/actions'
import ShareResult from '@/components/ShareResult'
import './results.css'

function one<T>(value:T|T[]|null|undefined):T|undefined{return Array.isArray(value)?value[0]:value??undefined}

export default async function AttemptReview({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{practice_error?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:attempt}=await supabase.from('attempts').select('id,student_id,score_percent,correct_count,total_questions,submitted_at,test_id,share_id,attempt_number,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,tests(title,teacher_id,review_mode,due_at,study_guide_enabled,focused_retake_enabled,randomized_retest_enabled,passing_score_percent,questions_per_attempt,require_focused_retake_before_full,focused_retake_percent,focused_retake_min_score,focused_retake_hints),share:test_shares(token,due_at,max_attempts,unlimited_attempts_until_due,study_guide_enabled,focused_retake_enabled,randomized_retest_enabled,require_focused_retake_before_full,focused_retake_percent,focused_retake_min_score,focused_retake_hints),student:profiles!attempts_student_id_fkey(full_name),responses(id,is_correct,choice_id,question_id,questions(prompt,position,content_area,choices(id,label,position))),attempt_integrity_events(event_type,created_at)').eq('id',id).single();if(!attempt)notFound()
  const test=one(attempt.tests),share=one(attempt.share),student=one(attempt.student);const isStudent=attempt.student_id===user.id,isTeacher=test?.teacher_id===user.id;if(!isStudent&&!isTeacher)notFound()
  const assignmentDue=share?.due_at??test?.due_at;const duePassed=Boolean(assignmentDue)&&Date.now()>=new Date(assignmentDue as string).getTime();const reviewAllowed=isTeacher||test?.review_mode==='immediate'||(test?.review_mode==='after_due'&&duePassed)
  const{data:lockedRows}=await supabase.from('attempt_questions').select('question_id,position').eq('attempt_id',id).order('position');const attemptPosition=new Map((lockedRows??[]).map((r:any)=>[String(r.question_id),Number(r.position)]))
  const responses=[...(attempt.responses??[])].sort((a:any,b:any)=>(attemptPosition.get(String(a.question_id))??9999)-(attemptPosition.get(String(b.question_id))??9999));const events=[...(attempt.attempt_integrity_events??[])].sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)))
  const passing=Number(test?.passing_score_percent??70),failed=Number(attempt.score_percent??0)<passing
  const requiredFocused=Boolean(share?share.require_focused_retake_before_full:test?.require_focused_retake_before_full);const focusedEnabled=requiredFocused||(share?.focused_retake_enabled??test?.focused_retake_enabled??true);const randomizedEnabled=share?.randomized_retest_enabled??test?.randomized_retest_enabled??true
  const focusedPercent=Number(share?.focused_retake_percent??test?.focused_retake_percent??50),focusedMinScore=Number(share?.focused_retake_min_score??test?.focused_retake_min_score??0),focusedHints=Boolean(share?.focused_retake_hints??test?.focused_retake_hints);const focusedCount=Math.max(1,Math.ceil(Number(test?.questions_per_attempt??attempt.total_questions??1)*focusedPercent/100))

  const areaMap=new Map<string,{total:number;correct:number;missed:number;rows:any[]}>()
  responses.forEach((r:any,index:number)=>{const q=one(r.questions as any),area=q?.content_area||'General review',row=areaMap.get(area)||{total:0,correct:0,missed:0,rows:[]};row.total++;if(r.is_correct)row.correct++;else row.missed++;row.rows.push({...r,attemptIndex:index+1});areaMap.set(area,row)})
  const allAreas=[...areaMap.entries()].sort((a,b)=>{const ap=a[1].correct/a[1].total,bp=b[1].correct/b[1].total;return ap-bp||b[1].missed-a[1].missed})
  const weakAreas=allAreas.filter(([,v])=>v.missed>0);const strongAreas=allAreas.filter(([,v])=>v.missed===0)
  const focusNames=weakAreas.map(([area])=>area)
  const{data:focusedSessions}=isStudent&&requiredFocused?await supabase.from('practice_sessions').select('score_percent,status').eq('source_attempt_id',id).eq('student_id',user.id).eq('status','submitted'):{data:[] as any[]};const focusedGateMet=!requiredFocused||(focusedSessions??[]).some((s:any)=>Number(s.score_percent??0)>=focusedMinScore)
  const freshHref=share?.token?`/share/${share.token}?fresh=1`:`/take/${attempt.test_id}?fresh=1`

  return <main className="attempt-results"><Link href={isStudent?'/dashboard':`/tests/${attempt.test_id}`}>← Back</Link><div className="result-heading"><div><p className="eyebrow">ATTEMPT {attempt.attempt_number}</p><h1>{test?.title}</h1></div><div className={`result-score ${failed?'needs-work':'passed'}`}><b>{attempt.score_percent}%</b><span>{attempt.correct_count}/{attempt.total_questions}</span></div></div>

    <section className="card subject-overview"><div className="row between"><div><h2>Subject results</h2><p className="muted">Start here. Open a subject only when you want the question-level detail.</p></div><span className="pill">{allAreas.length} subjects</span></div>
      <div className="subject-list">{allAreas.map(([area,v])=>{const pct=Math.round(v.correct/v.total*100);return <details className="subject-result" key={area}><summary><div><b>{area}</b><span>{v.correct} of {v.total} correct</span></div><strong className={pct>=passing?'good':pct<60?'bad':''}>{pct}%</strong></summary>
        {reviewAllowed?<div className="subject-question-list">{v.rows.map((r:any)=>{const q=one(r.questions as any),choices=q?.choices??[],selected=choices.find((c:any)=>c.id===r.choice_id);return <details className={`question-result ${r.is_correct?'correct':'incorrect'}`} key={r.id}><summary><span>Q{r.attemptIndex}. {q?.prompt}</span><b className={r.is_correct?'good':'bad'}>{r.is_correct?'Correct':'Incorrect'}</b></summary><div className="answer-detail"><span>Your answer</span><b>{selected?.label||'No answer'}</b></div></details>})}</div>:<p className="muted review-locked">Question-level review is available according to your teacher&apos;s review settings.</p>}
      </details>})}</div>
    </section>

    {isStudent&&failed&&focusedEnabled&&<section className="card focused-next" id="focused-retake"><span className="eyebrow">RECOMMENDED NEXT STEP</span><h2>{requiredFocused?'Focused retest required':'Focused retest'}</h2><p className="focused-lead">Your focused retest will <b>mostly consist of these subjects</b>, where you lost points:</p><div className="focus-subject-pills">{weakAreas.map(([area,v])=><span className="focus-subject" key={area}><b>{area}</b><small>{Math.round(v.correct/v.total*100)}%</small></span>)}</div>
      <form action={createFocusPractice.bind(null,id)} className="focus-form">{query.practice_error&&<p className="bad">{query.practice_error}</p>}{!requiredFocused&&focusNames.map(area=><input key={area} type="hidden" name="areas" value={area}/>)}<input type="hidden" name="question_count" value={requiredFocused?focusedCount:Math.min(20,Math.max(5,focusedCount))}/>
        {strongAreas.length>0&&<details className="select-more"><summary>+ Select more subjects <span>optional</span></summary><p className="muted">Added subjects provide some extra coverage. Your missed subjects remain the main focus.</p>{strongAreas.map(([area,v])=><label className="check" key={area}><input type="checkbox" name="areas" value={area}/><span>{area} <span className="muted">· {Math.round(v.correct/v.total*100)}%</span></span></label>)}</details>}
        <div className="focus-requirement"><b>{requiredFocused?`${focusedCount} questions`:`About ${Math.min(20,Math.max(5,focusedCount))} questions`}</b><span>{requiredFocused?(focusedMinScore===0?'Complete it to unlock your next full attempt':`${focusedMinScore}% required to unlock your next full attempt`):'Built from your weak subjects first'}{focusedHints?' · Hints enabled':''}</span></div><button className="focus-cta">Start focused retest</button>
      </form>
    </section>}

    {isStudent&&randomizedEnabled&&(!failed||focusedGateMet)&&<section className="card compact-next"><div><b>{failed?'Focused requirement complete':'Ready for another full test?'}</b><p className="muted">Start another allowed full attempt with a fresh subject-balanced question set.</p></div><Link className="button secondary" href={freshHref}>Start full retest</Link></section>}

    {isStudent&&attempt.submitted_at&&<details className="card secondary-results"><summary>More result options</summary><div className="secondary-result-body"><ShareResult score={Number(attempt.score_percent??0)} title={test?.title||'practice test'} passingScore={passing}/></div></details>}

    {isTeacher&&<details className="card secondary-results"><summary>Testing integrity</summary><div className="secondary-result-body"><p><b>{attempt.integrity_violation_count}</b> event(s) recorded · {attempt.focus_loss_count} focus loss · {attempt.fullscreen_exit_count} fullscreen exit</p>{events.map((e:any)=><p className="muted" key={`${e.event_type}-${e.created_at}`}>{new Date(e.created_at).toLocaleTimeString()} — {String(e.event_type).replaceAll('_',' ')}</p>)}</div></details>}
  </main>
}
