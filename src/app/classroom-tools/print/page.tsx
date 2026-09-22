import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import PrintButton from './PrintButton'

type PoolQuestion={
  id:string
  prompt:string
  choices:string[]
  correct_index:number
  exam_domain:string|null
  content_area:string|null
}
type Weight={exam_domain:string;weight_percent:number}
type PrintedQuestion={
  id:string
  prompt:string
  choices:string[]
  answerIndex:number
}

function shuffle<T>(items:T[]):T[]{
  const copy=[...items]
  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1))
    ;[copy[i],copy[j]]=[copy[j],copy[i]]
  }
  return copy
}

function chooseQuestions(pool:PoolQuestion[],weights:Weight[],count:number){
  const target=Math.min(count,pool.length)
  if(!weights.length)return shuffle(pool).slice(0,target)

  const totalWeight=weights.reduce((sum,w)=>sum+Number(w.weight_percent||0),0)||100
  const desired=weights.map(w=>{
    const exact=target*Number(w.weight_percent||0)/totalWeight
    return {...w,base:Math.floor(exact),fraction:exact-Math.floor(exact)}
  })
  let allocated=desired.reduce((sum,w)=>sum+w.base,0)

  for(const row of [...desired].sort((a,b)=>b.fraction-a.fraction||Number(b.weight_percent)-Number(a.weight_percent))){
    if(allocated>=target)break
    row.base+=1
    allocated+=1
  }

  const selected:PoolQuestion[]=[]
  const used=new Set<string>()
  for(const row of desired){
    const domainPool=shuffle(pool.filter(q=>q.exam_domain===row.exam_domain&&!used.has(q.id)))
    for(const q of domainPool.slice(0,row.base)){
      selected.push(q)
      used.add(q.id)
    }
  }

  if(selected.length<target){
    for(const q of shuffle(pool.filter(q=>!used.has(q.id))).slice(0,target-selected.length)){
      selected.push(q)
      used.add(q.id)
    }
  }

  return shuffle(selected).slice(0,target)
}

function prepareQuestion(q:PoolQuestion):PrintedQuestion{
  const choices=(Array.isArray(q.choices)?q.choices:[]).map((text,index)=>({
    text:String(text),
    correct:index===Number(q.correct_index)
  }))
  const randomized=shuffle(choices)
  return {
    id:q.id,
    prompt:q.prompt,
    choices:randomized.map(c=>c.text),
    answerIndex:randomized.findIndex(c=>c.correct)
  }
}

function answerLetter(index:number){
  return index>=0?String.fromCharCode(65+index):'—'
}

export default async function PrintableClassroomExam({searchParams}:{searchParams:Promise<{bundle?:string;preset?:string;count?:string;versions?:string}>}){
  const query=await searchParams
  if(!query.bundle||!query.preset)redirect('/classroom-tools')

  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const{data:poolData,error}=await supabase.rpc('get_teacher_classroom_print_pool',{
    p_bundle_id:query.bundle,
    p_preset_id:query.preset
  })
  if(error||!poolData)redirect('/classroom-tools?error='+encodeURIComponent(error?.message||'Printable exam unavailable'))

  const pool=(Array.isArray(poolData.questions)?poolData.questions:[]) as PoolQuestion[]
  if(pool.length<5)redirect('/classroom-tools?error='+encodeURIComponent('This preset does not have enough approved questions to print yet.'))

  const weights=(Array.isArray(poolData.weights)?poolData.weights:[]).map((w:any)=>({
    exam_domain:String(w.exam_domain),
    weight_percent:Number(w.weight_percent)
  })) as Weight[]
  const requested=Math.max(5,Math.min(200,Number(query.count||poolData.preset?.question_count||20)))
  const questionCount=Math.min(requested,pool.length)
  const versionCount=Math.max(1,Math.min(6,Number(query.versions||1)))
  const versions=Array.from({length:versionCount},(_,index)=>({
    label:String.fromCharCode(65+index),
    questions:chooseQuestions(pool,weights,questionCount).map(prepareQuestion)
  }))
  const generated=new Date().toLocaleDateString()

  return <main className="print-preview">
    <style>{'.print-preview{max-width:980px;margin:auto}.print-toolbar{position:sticky;top:10px;z-index:20;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:18px;box-shadow:0 8px 24px #11182712}.print-version,.answer-key{background:#fff;padding:28px 34px;margin:0 0 20px;border:1px solid #e2e8f0;border-radius:16px}.paper-heading{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:16px}.paper-heading h1{font-size:24px;margin:0}.paper-heading p{margin:3px 0 0;color:#475569}.student-lines{display:grid;grid-template-columns:2fr 1fr 1fr;gap:18px;margin:14px 0 20px}.student-line{border-bottom:1px solid #334155;min-height:28px;font-size:12px;color:#64748b}.paper-question{break-inside:avoid;margin:0 0 16px}.paper-question>p{font-weight:700;margin:0 0 6px}.paper-choice{margin:3px 0 3px 18px}.answer-grid{columns:4;column-gap:28px}.answer-item{break-inside:avoid;margin:0 0 4px}.paper-note{font-size:11px;color:#64748b;margin-top:18px}@media print{@page{margin:.5in}.site-header,.site-footer,.no-print{display:none!important}body{background:#fff!important}.print-preview{max-width:none;margin:0;padding:0}.print-version,.answer-key{border:0;border-radius:0;padding:0;margin:0;box-shadow:none}.print-version{break-after:page}.answer-key{break-before:page}.paper-heading{margin-top:0}}'}</style>

    <div className="print-toolbar no-print">
      <div><Link href="/classroom-tools">← Classroom tools</Link><b style={{display:'block',marginTop:4}}>Preview · {versionCount} version{versionCount===1?'':'s'} · {questionCount} questions each</b></div>
      <PrintButton/>
    </div>

    {versions.map(version=><section className="print-version" key={version.label}>
      <header className="paper-heading">
        <div><h1>{poolData.preset?.title||'Practice Exam'}</h1><p>{poolData.bundle?.title}</p></div>
        <div style={{textAlign:'right'}}><b>Version {version.label}</b><p>{questionCount} questions</p></div>
      </header>
      <div className="student-lines"><div className="student-line">Name</div><div className="student-line">Date</div><div className="student-line">Class / Period</div></div>
      <ol>
        {version.questions.map(q=><li className="paper-question" key={q.id}><p>{q.prompt}</p>{q.choices.map((choice,choiceIndex)=><div className="paper-choice" key={choiceIndex}>{answerLetter(choiceIndex)}. {choice}</div>)}</li>)}
      </ol>
      <p className="paper-note">Generated by CramLoop on {generated}. Original practice content; not an official PSI or licensing-board exam.</p>
    </section>)}

    <section className="answer-key">
      <header className="paper-heading">
        <div><h1>Teacher Answer Key</h1><p>{poolData.preset?.title} · {poolData.bundle?.title}</p></div>
        <div style={{textAlign:'right'}}><b>{versionCount} version{versionCount===1?'':'s'}</b><p>{questionCount} questions each</p></div>
      </header>
      {versions.map(version=><div key={version.label} style={{marginBottom:24}}>
        <h2>Version {version.label}</h2>
        <div className="answer-grid">{version.questions.map((q,index)=><div className="answer-item" key={q.id}><b>{index+1}.</b> {answerLetter(q.answerIndex)}</div>)}</div>
      </div>)}
      <p className="paper-note">Keep this page with the teacher copy.</p>
    </section>
  </main>
}
