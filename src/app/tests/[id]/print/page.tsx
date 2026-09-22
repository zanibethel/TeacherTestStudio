import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import PrintButton from '@/app/classroom-tools/print/PrintButton'

type Choice={id:string;label:string;position:number}
type Question={
  id:string
  prompt:string
  position:number
  choices:Choice[]
  question_answers:{choice_id:string}[]|{choice_id:string}|null
}
type PrintedQuestion={id:string;prompt:string;choices:string[];answerIndex:number}

function shuffle<T>(items:T[]):T[]{
  const copy=[...items]
  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1))
    ;[copy[i],copy[j]]=[copy[j],copy[i]]
  }
  return copy
}

function answerLetter(index:number){
  return index>=0?String.fromCharCode(65+index):'—'
}

function answerRow(question:Question,randomizeChoices:boolean):PrintedQuestion{
  const choices=[...(question.choices??[])].sort((a,b)=>a.position-b.position)
  const answer=Array.isArray(question.question_answers)?question.question_answers[0]:question.question_answers
  const prepared=choices.map(choice=>({id:choice.id,text:choice.label,correct:choice.id===answer?.choice_id}))
  const ordered=randomizeChoices?shuffle(prepared):prepared
  return {id:question.id,prompt:question.prompt,choices:ordered.map(choice=>choice.text),answerIndex:ordered.findIndex(choice=>choice.correct)}
}

export default async function SavedTestPrint({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{configured?:string;count?:string;versions?:string;random_questions?:string;random_choices?:string}>}){
  const{id}=await params
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')

  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const{data:test,error}=await supabase.from('tests')
    .select('id,teacher_id,title,description,chapter_label,assessment_type,duration_minutes,passing_score_percent,randomize_questions,randomize_choices,questions_per_attempt,questions(id,prompt,position,choices(id,label,position),question_answers(choice_id))')
    .eq('id',id)
    .single()

  if(error||!test||test.teacher_id!==user.id)notFound()

  const sourceQuestions=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position) as Question[]
  if(!sourceQuestions.length)notFound()

  const configured=query.configured==='1'
  const defaultCount=Math.min(Number(test.questions_per_attempt||sourceQuestions.length),sourceQuestions.length)
  const requestedCount=Math.max(1,Math.min(sourceQuestions.length,Number(query.count||defaultCount)))
  const versionCount=Math.max(1,Math.min(6,Number(query.versions||1)))
  const randomizeQuestions=configured?query.random_questions==='1':Boolean(test.randomize_questions||test.questions_per_attempt)
  const randomizeChoices=configured?query.random_choices==='1':Boolean(test.randomize_choices)

  const versions=Array.from({length:versionCount},(_,index)=>{
    const selected=(randomizeQuestions||requestedCount<sourceQuestions.length?shuffle(sourceQuestions):[...sourceQuestions]).slice(0,requestedCount)
    return {label:String.fromCharCode(65+index),questions:selected.map(question=>answerRow(question,randomizeChoices))}
  })

  const generated=new Date().toLocaleDateString()

  return <main className="print-preview">
    <style>{'.print-preview{max-width:980px;margin:auto}.print-toolbar{position:sticky;top:10px;z-index:20;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:18px;box-shadow:0 8px 24px #11182712}.print-toolbar-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.print-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:12px;align-items:end}.print-options label{margin:0}.print-check{display:flex;gap:8px;align-items:center;min-height:42px}.print-check input{width:auto;margin:0}.print-version,.answer-key{background:#fff;padding:28px 34px;margin:0 0 20px;border:1px solid #e2e8f0;border-radius:16px}.paper-heading{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:16px}.paper-heading h1{font-size:24px;margin:0}.paper-heading p{margin:3px 0 0;color:#475569}.student-lines{display:grid;grid-template-columns:2fr 1fr 1fr;gap:18px;margin:14px 0 20px}.student-line{border-bottom:1px solid #334155;min-height:28px;font-size:12px;color:#64748b}.paper-question{break-inside:avoid;margin:0 0 16px}.paper-question>p{font-weight:700;margin:0 0 6px}.paper-choice{margin:3px 0 3px 18px}.answer-grid{columns:4;column-gap:28px}.answer-item{break-inside:avoid;margin:0 0 4px}.paper-note{font-size:11px;color:#64748b;margin-top:18px}@media(max-width:760px){.print-options{grid-template-columns:1fr 1fr}}@media print{@page{margin:.5in}.site-header,.site-footer,.no-print{display:none!important}body{background:#fff!important}.print-preview{max-width:none;margin:0;padding:0}.print-version,.answer-key{border:0;border-radius:0;padding:0;margin:0;box-shadow:none}.print-version{break-after:page}.answer-key{break-before:page}.paper-heading{margin-top:0}}'}</style>

    <section className="print-toolbar no-print">
      <div className="print-toolbar-head">
        <div><Link href={'/tests/'+id+'/preview'}>← Test preview</Link><b style={{display:'block',marginTop:4}}>Print saved test · {versionCount} version{versionCount===1?'':'s'} · {requestedCount} questions each</b></div>
        <PrintButton/>
      </div>
      <form method="get" className="print-options">
        <input type="hidden" name="configured" value="1"/>
        <label>Questions<input name="count" type="number" min="1" max={sourceQuestions.length} defaultValue={requestedCount}/></label>
        <label>Versions<select name="versions" defaultValue={String(versionCount)}><option value="1">1 version</option><option value="2">2 versions</option><option value="3">3 versions</option><option value="4">4 versions</option><option value="5">5 versions</option><option value="6">6 versions</option></select></label>
        <label className="print-check"><input type="checkbox" name="random_questions" value="1" defaultChecked={randomizeQuestions}/><span>Randomize questions</span></label>
        <label className="print-check"><input type="checkbox" name="random_choices" value="1" defaultChecked={randomizeChoices}/><span>Randomize choices</span></label>
        <button type="submit">Regenerate preview</button>
      </form>
      <p className="muted" style={{margin:'10px 0 0'}}>Uses this saved test&apos;s {sourceQuestions.length}-question pool. Regenerating changes the randomized versions but does not modify the saved test.</p>
    </section>

    {versions.map(version=><section className="print-version" key={version.label}>
      <header className="paper-heading">
        <div><h1>{test.title}</h1><p>{test.chapter_label||test.description||'CramLoop classroom test'}</p></div>
        <div style={{textAlign:'right'}}><b>Version {version.label}</b><p>{requestedCount} questions{test.duration_minutes?' · '+test.duration_minutes+' min':''}</p></div>
      </header>
      <div className="student-lines"><div className="student-line">Name</div><div className="student-line">Date</div><div className="student-line">Class / Period</div></div>
      <ol>{version.questions.map(q=><li className="paper-question" key={q.id}><p>{q.prompt}</p>{q.choices.map((choice,index)=><div className="paper-choice" key={index}>{answerLetter(index)}. {choice}</div>)}</li>)}</ol>
      <p className="paper-note">Generated from the saved CramLoop test on {generated}. Version {version.label} · {test.passing_score_percent}% passing target.</p>
    </section>)}

    <section className="answer-key">
      <header className="paper-heading">
        <div><h1>Teacher Answer Key</h1><p>{test.title}</p></div>
        <div style={{textAlign:'right'}}><b>{versionCount} version{versionCount===1?'':'s'}</b><p>{requestedCount} questions each</p></div>
      </header>
      {versions.map(version=><div key={version.label} style={{marginBottom:24}}><h2>Version {version.label}</h2><div className="answer-grid">{version.questions.map((q,index)=><div className="answer-item" key={q.id}><b>{index+1}.</b> {answerLetter(q.answerIndex)}</div>)}</div></div>)}
      <p className="paper-note">Keep this page with the teacher copy.</p>
    </section>
  </main>
}
