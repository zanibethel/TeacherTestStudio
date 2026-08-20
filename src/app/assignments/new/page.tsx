import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import ShareSetupForm from '@/app/tests/[id]/ShareSetupForm'
import {createShareOffer} from '@/app/tests/[id]/actions'
import CopyShareLinkButton from '@/app/tests/[id]/CopyShareLinkButton'

export default async function NewAssignment({searchParams}:{searchParams:Promise<{test?:string;error?:string;created?:string;token?:string;audience?:string;label?:string;targets?:string;group?:string;created_test?:string}>}){
  const query=await searchParams
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved,teacher_plan,teacher_plan_expires_at').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const proActive=profile.teacher_plan==='pro'&&(!profile.teacher_plan_expires_at||new Date(profile.teacher_plan_expires_at).getTime()>Date.now())
  const{data:tests}=await supabase.from('tests').select('id,title,description,status,updated_at,questions(count)').eq('teacher_id',user.id).neq('status','archived').order('updated_at',{ascending:false})

  if(!query.test){
    return <main>
      <Link href="/dashboard">← Dashboard</Link>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'end',gap:16,marginTop:12}}>
        <div><h1 style={{margin:'0 0 4px'}}>Choose a test</h1><p className="muted" style={{margin:0}}>Select a test to assign.</p></div>
        <Link href="/tests/new" style={{fontWeight:800,whiteSpace:'nowrap',paddingBottom:4}}>Build a new test →</Link>
      </div>
      {query.error&&<p className="bad notice">{query.error}</p>}
      {!tests?.length?<section className="card empty-state" style={{marginTop:18}}><h2>No tests yet</h2><p className="muted">Build your first test from the Question Bank, then assign it here.</p><Link className="button" href="/tests/new">Build a test</Link></section>:<section style={{marginTop:18}}><h2 style={{margin:'0 0 10px',fontSize:20}}>Available tests</h2><div style={{display:'grid',gap:10}}>{tests.map((test:any)=><Link key={test.id} href={`/assignments/new?test=${test.id}`} className="card card-link" style={{margin:0,padding:'16px 18px'}}><div className="row between" style={{gap:12,alignItems:'center',flexWrap:'nowrap'}}><div style={{minWidth:0}}><b style={{display:'block',fontSize:18}}>{test.title}</b>{test.description&&<p className="muted" style={{margin:'3px 0 2px'}}>{test.description}</p>}<small className="muted" style={{display:'block'}}>{test.questions?.[0]?.count??0} questions</small></div><span aria-hidden style={{fontWeight:900,fontSize:22}}>→</span></div></Link>)}</div></section>}
    </main>
  }

  const test=(tests??[]).find((row:any)=>row.id===query.test)
  if(!test)redirect('/assignments/new?error='+encodeURIComponent('Choose a test from your library.'))
  const[{data:roster},{data:groups},{data:presets},{data:testMeta}]=await Promise.all([
    supabase.from('teacher_student_roster').select('id,student_email,student_id').eq('teacher_id',user.id).order('student_email'),
    supabase.from('teacher_groups').select('id,name,teacher_group_members(count)').eq('teacher_id',user.id).order('name'),
    supabase.from('teacher_share_experience_presets').select('id,name,settings').eq('teacher_id',user.id).order('updated_at',{ascending:false}),
    supabase.from('tests').select('questions_per_attempt,questions(count)').eq('id',test.id).single(),
  ])
  const audienceRoster=(roster??[]).map((r:any)=>({id:r.id,student_email:r.student_email,student_id:r.student_id??null}))
  const audienceGroups=(groups??[]).map((g:any)=>({id:g.id,name:g.name,member_count:g.teacher_group_members?.[0]?.count??0}))
  const fullQuestionCount=(testMeta as any)?.questions_per_attempt||((testMeta as any)?.questions?.[0]?.count??1)
  const createdUrl=query.token?`https://cramloop.app/share/${query.token}`:null
  const targetText=query.targets||(query.audience==='groups'?'selected class(es)':query.audience==='students'?'selected student(s)':'anyone with the link')
  const progressHref=query.group?`/teacher-progress?group=${encodeURIComponent(query.group)}`:'/teacher-progress'

  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><span className="eyebrow">CREATE ASSIGNMENT</span><h1 style={{margin:'5px 0'}}>Assign {test.title}</h1><p className="muted" style={{margin:0}}>Choose who gets it, then use the default preset or open more options only if needed.</p></div><Link className="secondary button" href="/assignments/new">Change test</Link></div>
    {query.created_test&&<p className="good notice">Test saved. Now choose who should get it.</p>}
    {query.error&&<p className="bad notice">{query.error}</p>}
    {query.created&&createdUrl&&<section id="share-success" className="card" style={{border:'2px solid #86efac',background:'#f0fdf4'}}><span className="eyebrow">ASSIGNMENT CREATED</span><h2 style={{margin:'6px 0'}}>{query.label||'Assignment ready'}</h2><p style={{margin:'4px 0'}}>Assigned to <b>{targetText}</b>.</p><p className="muted">Students can now access it through their normal CramLoop assignment flow.</p><div className="row" style={{gap:8,flexWrap:'wrap'}}><Link className="button" href={progressHref}>View student progress</Link><Link className="secondary button" href={`/reports?assignment=${query.created}`}>View assignment report</Link><CopyShareLinkButton url={createdUrl}/></div></section>}
    <form action={createShareOffer.bind(null,test.id)} className="stack">
      <input type="hidden" name="return_to" value={`/assignments/new?test=${test.id}`}/>
      <ShareSetupForm roster={audienceRoster} groups={audienceGroups} presets={(presets??[]) as any} proActive={proActive} fullQuestionCount={fullQuestionCount}/>
      <button style={{width:'100%'}}>Create assignment</button>
    </form>
  </main>
}
