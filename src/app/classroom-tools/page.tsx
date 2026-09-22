import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {startLocalClassroomExam} from './actions'

type Preset=Record<string,any>

function isPsiStyle(preset:Preset){
  return /psi/i.test(String(preset.title||'')+' '+String(preset.provider_label||'')+' '+String(preset.mode_label||''))
}

export default async function ClassroomTools({searchParams}:{searchParams:Promise<{error?:string;bundle?:string;preset?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const[{data:catalog,error:catalogError},{data:history}]=await Promise.all([
    supabase.rpc('get_teacher_classroom_exam_catalog'),
    supabase.from('practice_sessions')
      .select('id,local_student_name,title,status,score_percent,correct_count,question_count,created_at,submitted_at,source_bundle_id,source_exam_preset_id')
      .eq('teacher_id',user.id)
      .eq('session_kind','local_exam_preset')
      .order('created_at',{ascending:false})
      .limit(20)
  ])

  const presets:Preset[]=Array.isArray(catalog)?catalog:[]
  const bundles=Array.from(presets.reduce((map:Map<string,Preset[]>,preset:Preset)=>{
    const key=String(preset.bundle_id)
    map.set(key,[...(map.get(key)||[]),preset])
    return map
  },new Map()).entries())

  return <main>
    <Link href="/dashboard">← Teacher dashboard</Link>
    <div className="row between" style={{alignItems:'flex-start',gap:16}}>
      <div><span className="eyebrow">CLASSROOM TOOLS</span><h1>Run or print a fresh practice exam</h1><p className="muted">Use CramLoop&apos;s verified platform question pools for quick in-class testing without creating a permanent student account or another saved test.</p></div>
      <span className="pill">{presets.length} preset{presets.length===1?'':'s'}</span>
    </div>

    {(query.error||catalogError)&&<p className="bad notice">{query.error||catalogError?.message}</p>}

    {!bundles.length?<section className="card"><h2>No classroom exam presets available</h2><p className="muted">Published platform exam presets will appear here automatically.</p></section>:bundles.map(([bundleId,bundlePresets])=><section className="card" key={bundleId}>
      <div className="row between" style={{alignItems:'flex-start',gap:14}}>
        <div><span className="eyebrow">PRACTICE BUNDLE</span><h2 style={{margin:'6px 0 4px'}}>{bundlePresets[0]?.bundle_title}</h2><p className="muted" style={{marginTop:0}}>{bundlePresets[0]?.jurisdiction||bundlePresets[0]?.subject}</p></div>
        {bundlePresets[0]?.verified&&<span className="pill">CramLoop Verified</span>}
      </div>

      <div className="stack">{bundlePresets.map((preset:Preset)=>{
        const selected=query.bundle===String(bundleId)&&query.preset===String(preset.id)
        const availableCount=Number(preset.available_question_count||0)
        const defaultCount=Math.min(Number(preset.question_count||20),availableCount||Number(preset.question_count||20))
        return <section className="question-summary" id={selected?'local-start':undefined} key={preset.id} style={{padding:18,border:selected?'2px solid var(--primary,#4338ca)':undefined}}>
          <div className="row between" style={{alignItems:'flex-start',gap:12}}>
            <div><div className="row" style={{gap:8,flexWrap:'wrap'}}>{preset.provider_label&&<span className="pill">{preset.provider_label}</span>}{isPsiStyle(preset)&&<span className="pill">PSI-style</span>}</div><h3 style={{margin:'8px 0 4px'}}>{preset.title}</h3><p className="muted" style={{margin:0}}>{preset.description}</p></div>
            <span className="pill">{preset.question_count} questions</span>
          </div>
          <p className="muted">{preset.duration_minutes?String(preset.duration_minutes)+' min · ':''}{preset.passing_score_percent}% target · {availableCount} approved questions in pool</p>

          <div className="grid two" style={{alignItems:'start'}}>
            <form action={startLocalClassroomExam.bind(null,String(bundleId),String(preset.id))} className="card" style={{margin:0,padding:16}}>
              <span className="eyebrow">LOCAL COMPUTER</span>
              <h3 style={{margin:'6px 0'}}>Start local student exam</h3>
              <p className="muted">Enter the student&apos;s name, hand them this computer, and CramLoop will save the score and topic breakdown to your local-attempt history.</p>
              <label>Student name<input name="student_name" required maxLength={120} autoComplete="off" placeholder="Student name"/></label>
              <button type="submit">Start local exam</button>
            </form>

            <form action="/classroom-tools/print" method="get" className="card" style={{margin:0,padding:16}}>
              <input type="hidden" name="bundle" value={String(bundleId)}/>
              <input type="hidden" name="preset" value={String(preset.id)}/>
              <span className="eyebrow">PRINTABLE</span>
              <h3 style={{margin:'6px 0'}}>Generate randomized paper test</h3>
              <p className="muted">Creates fresh question and answer-choice order plus a matching teacher answer key. Nothing is added to your saved test library.</p>
              <div className="grid two">
                <label>Questions<input name="count" type="number" min="5" max={Math.min(200,availableCount||200)} defaultValue={defaultCount}/></label>
                <label>Versions<select name="versions" defaultValue="1"><option value="1">1 version</option><option value="2">2 versions</option><option value="3">3 versions</option><option value="4">4 versions</option><option value="5">5 versions</option><option value="6">6 versions</option></select></label>
              </div>
              <button type="submit">Generate printable test</button>
            </form>
          </div>
        </section>
      })}</div>
    </section>)}

    <div className="row between" style={{alignItems:'end',marginTop:28}}><div><span className="eyebrow">LOCAL ATTEMPTS</span><h2 style={{margin:'4px 0'}}>Recent classroom results</h2></div><span className="pill">{history?.length||0} recent</span></div>
    {!history?.length?<section className="card"><p className="muted">Local student attempts will appear here after you launch one from this page.</p></section>:<div className="stack">{history.map((row:any)=><Link className="card card-link result-row" key={row.id} href={'/classroom-tools/local/'+row.id}>
      <div><b>{row.local_student_name||'Local student'}</b><p className="muted">{row.title} · {new Date(row.created_at).toLocaleString()}</p></div>
      <strong>{row.status==='submitted'?String(row.score_percent)+'%':'In progress'}</strong>
    </Link>)}</div>}
  </main>
}
