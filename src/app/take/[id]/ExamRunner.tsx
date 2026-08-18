'use client'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

type Choice = { id:string; label:string; position:number }
type Question = { id:string; prompt:string; position:number; choices:Choice[] }
type Props = {
  attemptId:string; attemptNumber:number; testId:string; title:string; description:string|null; questions:Question[];
  deadlineAt:string|null; oneQuestionPerPage:boolean; passingScore:number; allowSaveResume:boolean;
  strictMode:boolean; integrityAction:'flag'|'warn'|'auto_submit'; integrityLimit:number;
  initialAnswers:Record<string,string>;
  action:(formData:FormData)=>void;
  saveAction:(answers:Record<string,string>)=>Promise<{ok:boolean;error?:string}>;
  integrityActionCall:(eventType:string)=>Promise<{ok:boolean;count:number}>;
}

function formatTime(seconds:number){const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;return h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}

export default function ExamRunner(props:Props){
  const {attemptNumber,title,description,questions,deadlineAt,oneQuestionPerPage,passingScore,allowSaveResume,strictMode,integrityAction,integrityLimit,initialAnswers,action,saveAction,integrityActionCall}=props
  const [current,setCurrent]=useState(0)
  const [answers,setAnswers]=useState<Record<string,string>>(initialAnswers)
  const [remaining,setRemaining]=useState(deadlineAt?Math.max(0,Math.floor((new Date(deadlineAt).getTime()-Date.now())/1000)):0)
  const [started,setStarted]=useState(!strictMode)
  const [violations,setViolations]=useState(0)
  const [notice,setNotice]=useState('')
  const [isPending,startTransition]=useTransition()
  const formRef=useRef<HTMLFormElement>(null)
  const submitted=useRef(false)
  const suppressFullscreen=useRef(false)
  const answeredCount=useMemo(()=>Object.values(answers).filter(Boolean).length,[answers])

  useEffect(()=>{
    if(!deadlineAt)return
    const tick=()=>{const left=Math.max(0,Math.floor((new Date(deadlineAt).getTime()-Date.now())/1000));setRemaining(left);if(left===0&&!submitted.current){submitted.current=true;const auto=formRef.current?.querySelector<HTMLInputElement>('input[name="auto_submit"]');if(auto)auto.value='1';formRef.current?.requestSubmit()}}
    tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer)
  },[deadlineAt])

  async function recordViolation(type:string){
    if(!strictMode||!started||submitted.current)return
    const result=await integrityActionCall(type)
    if(!result.ok)return
    setViolations(result.count)
    if(integrityAction==='warn')setNotice(`Testing integrity warning: ${result.count} violation${result.count===1?'':'s'} recorded.`)
    if(integrityAction==='auto_submit'&&result.count>=integrityLimit){setNotice('Integrity limit reached. Your test is being submitted.');submitted.current=true;const auto=formRef.current?.querySelector<HTMLInputElement>('input[name="auto_submit"]');if(auto)auto.value='1';formRef.current?.requestSubmit()}
  }

  useEffect(()=>{
    if(!strictMode)return
    const visibility=()=>{if(document.hidden)void recordViolation('focus_lost')}
    const fullscreen=()=>{if(started&&!document.fullscreenElement&&!suppressFullscreen.current)void recordViolation('fullscreen_exited')}
    const copy=(e:ClipboardEvent)=>{if(started){e.preventDefault();void recordViolation('copy_attempt')}}
    const paste=(e:ClipboardEvent)=>{if(started){e.preventDefault();void recordViolation('paste_attempt')}}
    const context=(e:MouseEvent)=>{if(started){e.preventDefault();void recordViolation('context_menu')}}
    document.addEventListener('visibilitychange',visibility);document.addEventListener('fullscreenchange',fullscreen);document.addEventListener('copy',copy);document.addEventListener('paste',paste);document.addEventListener('contextmenu',context)
    return()=>{document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',fullscreen);document.removeEventListener('copy',copy);document.removeEventListener('paste',paste);document.removeEventListener('contextmenu',context)}
  },[strictMode,started])

  async function beginStrict(){try{await document.documentElement.requestFullscreen()}catch{}setStarted(true)}
  function choose(questionId:string,choiceId:string){const next={...answers,[questionId]:choiceId};setAnswers(next);if(allowSaveResume)startTransition(()=>{void saveAction(next)})}
  function submit(){submitted.current=true;suppressFullscreen.current=true;if(document.fullscreenElement)void document.exitFullscreen()}
  const question=questions[current]
  const warning=Boolean(deadlineAt)&&remaining<=300

  if(strictMode&&!started)return <main className="exam-shell"><section className="card"><p className="eyebrow">Strict Test Mode</p><h1>{title}</h1><p>This test monitors tab/app changes, fullscreen exits, copy/paste attempts, and right-click activity. These events are recorded for your teacher.</p><p className="muted">Attempt {attemptNumber}. Once you begin, stay in this test window until you submit.</p><button type="button" onClick={beginStrict}>Begin test in fullscreen</button></section></main>

  return <main className="exam-shell">
    <header className="exam-header"><div><p className="eyebrow">Attempt {attemptNumber}{strictMode?' · Strict Test Mode':''}</p><h1>{title}</h1></div><div className={`timer ${warning?'timer-warning':''}`}><span>Time remaining</span><b>{deadlineAt?formatTime(remaining):'Untimed'}</b></div></header>
    {description&&<p className="muted">{description}</p>}
    {notice&&<p className="bad">{notice}</p>}
    <div className="exam-meta"><span>{answeredCount} of {questions.length} answered</span><span>Passing target: {passingScore}%</span>{strictMode&&<span>Integrity events: {violations}</span>}{allowSaveResume&&<span>{isPending?'Saving…':'Progress saved'}</span>}</div>
    <form ref={formRef} action={action} onSubmit={submit}>
      <input type="hidden" name="auto_submit" defaultValue="0"/>
      {questions.map(q=><input key={q.id} type="hidden" name={`q_${q.id}`} value={answers[q.id]??''}/>) }
      {oneQuestionPerPage?<>
        <section className="card exam-question"><p className="question-progress">Question {current+1} of {questions.length}</p><h2>{question.prompt}</h2>{question.choices.map(c=><label className={`answer ${answers[question.id]===c.id?'answer-selected':''}`} key={c.id}><input type="radio" name={`visible_${question.id}`} checked={answers[question.id]===c.id} onChange={()=>choose(question.id,c.id)}/><span>{c.label}</span></label>)}</section>
        <div className="exam-nav"><button className="secondary" type="button" onClick={()=>setCurrent(i=>Math.max(0,i-1))} disabled={current===0}>Previous</button><div className="question-dots">{questions.map((q,i)=><button type="button" key={q.id} className={`question-dot ${i===current?'current':''} ${answers[q.id]?'answered':''}`} onClick={()=>setCurrent(i)}>{i+1}</button>)}</div>{current<questions.length-1?<button type="button" onClick={()=>setCurrent(i=>Math.min(questions.length-1,i+1))}>Next</button>:<button type="submit">Submit exam</button>}</div>
      </>:<>{questions.map((q,index)=><section className="card exam-question" key={q.id}><p className="question-progress">Question {index+1} of {questions.length}</p><h2>{q.prompt}</h2>{q.choices.map(c=><label className={`answer ${answers[q.id]===c.id?'answer-selected':''}`} key={c.id}><input type="radio" name={`visible_${q.id}`} checked={answers[q.id]===c.id} onChange={()=>choose(q.id,c.id)}/><span>{c.label}</span></label>)}</section>)}<button type="submit">Submit exam</button></>}
    </form>
  </main>
}
