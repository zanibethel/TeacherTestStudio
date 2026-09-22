import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {submitLocalClassroomExam} from '../../actions'
import ClassroomExamRunner from './ClassroomExamRunner'

export default async function LocalClassroomExam({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const{id}=await params
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const{data:session}=await supabase.from('practice_sessions')
    .select('id,student_id,teacher_id,local_student_name,title,status,score_percent,correct_count,question_count,source_bundle_id,source_exam_preset_id,session_kind,duration_minutes,passing_score_percent,deadline_at,created_at,submitted_at')
    .eq('id',id)
    .single()

  if(!session||session.teacher_id!==user.id||session.student_id!==user.id||session.session_kind!=='local_exam_preset')notFound()

  if(session.status==='submitted'){
    const{data:report,error}=await supabase.rpc('get_teacher_local_exam_report',{p_session_id:id})
    if(error||!report)notFound()
    const areas=Array.isArray(report.areas)?report.areas:[]
    const score=Number(report.score_percent||0)
    const target=Number(report.passing_score_percent??70)
    return <main className="narrow">
      <Link href="/classroom-tools">← Classroom tools</Link>
      <span className="eyebrow">LOCAL CLASSROOM RESULT</span>
      <h1>{report.student_name}</h1>
      <p className="muted">{report.title} · {report.bundle_title}</p>
      <section className="score-card"><span className="score">{score}%</span><div><b>{report.correct_count} of {report.question_count} correct</b><p className="muted">{score>=target?'Practice target reached':'Below practice target'} · target {target}%</p></div></section>

      <section className="card">
        <h2>Topic breakdown</h2>
        {areas.length?<div className="stack">{areas.map((area:any)=><div className="row between question-summary" key={area.area}>
          <div><b>{area.area}</b><p className="muted" style={{margin:'3px 0 0'}}>{area.correct} of {area.total} correct</p></div>
          <strong>{Number(area.mastery).toFixed(0)}%</strong>
        </div>)}</div>:<p className="muted">No topic breakdown was available for this attempt.</p>}
      </section>

      <section className="card">
        <h2>Next student</h2>
        <p className="muted">This result is saved under your local classroom attempts. Start a fresh randomized exam for the next student from the same preset.</p>
        <div className="row" style={{flexWrap:'wrap'}}>
          <Link className="button" href={'/classroom-tools?bundle='+report.source_bundle_id+'&preset='+report.source_exam_preset_id+'#local-start'}>Start next student</Link>
          <Link className="secondary button" href="/classroom-tools">View all local attempts</Link>
        </div>
      </section>
    </main>
  }

  const{data:rows,error}=await supabase.rpc('get_practice_session',{p_session_id:id})
  if(error||!rows?.length)notFound()
  const questions=(rows??[]).map((q:any)=>({
    question_id:String(q.question_id),
    question_position:Number(q.question_position),
    prompt:String(q.prompt),
    content_area:q.content_area?String(q.content_area):null,
    choices:Array.isArray(q.choices)?q.choices.map(String):[],
    focused_retake_hint:null,
    previous_answer:null
  }))

  return <>
    {query.error&&<div className="no-print" style={{position:'fixed',top:8,left:'50%',transform:'translateX(-50%)',zIndex:200}}><p className="bad notice">{query.error}</p></div>}
    <ClassroomExamRunner
      title={session.title+' · '+session.local_student_name}
      questions={questions}
      showHints={false}
      required={false}
      minScore={0}
      modeLabel="Licensing exam simulation"
      deadlineAt={session.deadline_at}
      durationMinutes={session.duration_minutes}
      passingScore={session.passing_score_percent}
      action={submitLocalClassroomExam.bind(null,id)}
    />
  </>
}
