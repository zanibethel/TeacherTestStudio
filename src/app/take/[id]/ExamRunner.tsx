'use client'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import './exam.css'

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
  const touchStart=useRef<{x:number;y:number}|null>(null)
  const dotRefs=useRef<Array<HTMLButtonElement|null>>([])
  const answeredCount=useMemo(()=>Object.values(answers).filter(Boolean).length,[answers])
  const unanswered=useMemo(()=>questions.map((q,i)=>answers[q.id]?null:i).filter((i):i is number=>i!==null),[answers,questions])

  useEffect(()=>{
    if(!deadlineAt)return
    const tick=()=>{const left=Math.max(0,Math.floor((new Date(deadlineAt).getTime()-Date.now())/1000));setRemaining(left);if(left===0&&!submitted.current){submitted.current=true;const auto=formRef.current?.querySelector<HTMLInputElement>('input[name="auto_submit"]');if(auto)auto.value='1';formRef.current?.requestSubmit()}}
    tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer)
  },[deadlineAt])

  useEffect(()=>{dotRefs.current[current]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})},[current])

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
  function choose(questionId:string,choiceId:string){const next={...answers,[questionId]:choiceId};setAnswers(next);setNotice('');if(allowSaveResume)startTransition(()=>{void saveAction(next)})}
  function submit(event:React.FormEvent<HTMLFormElement>){
    const auto=event.currentTarget.elements.namedItem('auto_submit') as HTMLInputElement|null
    const isAuto=auto?.value==='1'
    if(!isAuto&&answeredCount<questions.length){
      event.preventDefault();submitted.current=false
      const firstUnanswered=unanswered[0]
      if(firstUnanswered!==undefined)setCurrent(firstUnanswered)
      setNotice(`Answer all ${questions.length} questions before submitting. ${questions.length-answeredCount} remaining.`)
      return
    }
    submitted.current=true;suppressFullscreen.current=true;if(document.fullscreenElement)void document.exitFullscreen()
  }
  function previous(){setCurrent(i=>Math.max(0,i-1))}
  function next(){
    if(current<questions.length-1){setCurrent(i=>i+1);return}
    const nextUnanswered=unanswered.find(i=>i!==current)
    if(nextUnanswered!==undefined)setCurrent(nextUnanswered)
  }
  function onTouchStart(e:React.TouchEvent){const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY}}
  function onTouchEnd(e:React.TouchEvent){
    const start=touchStart.current;touchStart.current=null;if(!start)return
    const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y
    if(Math.abs(dx)<55||Math.abs(dx)<=Math.abs(dy)*1.2)return
    if(dx<0)next();else previous()
  }
  const question=questions[current]
  const warning=Boolean(deadlineAt)&&remaining<=300
  const atEnd=current===questions.length-1
  const hasOtherUnanswered=unanswered.some(i=>i!==current)
  const canSubmit=answeredCount===questions.length

  if(strictMode&&!started)return <main className="exam-shell"><section className="card"><p className="eyebrow">Strict Test Mode</p><h1>{title}</h1><p>This test monitors tab/app changes, fullscreen exits, copy/paste attempts, and right-click activity. These events are recorded for your teacher.</p><p className="muted">Attempt {attemptNumber}. Once you begin, stay in this test window until you submit.</p><button type="button" onClick={beginStrict}>Begin test in fullscreen</button></section></main>

  return <main className={`exam-shell ${oneQuestionPerPage?'exam-single-page':''}`}>
    <header className="exam-header"><div className="exam-title-block"><p className="eyebrow">Attempt {attemptNumber}{strictMode?' · Restricted':''}</p><h1>{title}</h1></div><div className={`timer ${warning?'timer-warning':''}`}><span>Time</span><b>{deadlineAt?formatTime(remaining):'Untimed'}</b></div></header>
    {description&&<p className="muted exam-description">{description}</p>}
    {notice&&<p className="bad exam-notice">{notice}</p>}
    <div className="exam-meta"><span>{answeredCount}/{questions.length} answered</span><span>Pass {passingScore}%</span>{strictMode&&<span>{violations} integrity event{violations===1?'':'s'}</span>}{allowSaveResume&&<span>{isPending?'Saving…':'Saved'}</span>}</div>
    <form ref={formRef} action={action} onSubmit={submit}>
      <input type="hidden" name="auto_submit" defaultValue="0"/>
      {questions.map(q=><input key={q.id} type="hidden" name={`q_${q.id}`} value={answers[q.id]??''}/>) }
      {oneQuestionPerPage?<>
        <section className="card exam-question exam-question-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <p className="question-progress">Question {current+1} of {questions.length}</p>
          <h2>{question.prompt}</h2>
          <div className="exam-answer-list">{question.choices.map(c=><label className={`answer ${answers[question.id]===c.id?'answer-selected':''}`} key={c.id}><input type="radio" name={`visible_${question.id}`} checked={answers[question.id]===c.id} onChange={()=>choose(question.id,c.id)}/><span>{c.label}</span></label>)}</div>
          <p className="swipe-hint">Swipe left/right to move between questions.</p>
        </section>
        <div className="exam-mobile-dock">
          <div className="question-dots" aria-label="Question navigation">{questions.map((q,i)=><button ref={el=>{dotRefs.current[i]=el}} type="button" key={q.id} className={`question-dot ${i===current?'current':''} ${answers[q.id]?'answered':''}`} onClick={()=>setCurrent(i)} aria-label={`Question ${i+1}${answers[q.id]?', answered':', unanswered'}`}>{i+1}</button>)}</div>
          <div className="exam-nav-buttons"><button className="secondary" type="button" onClick={previous} disabled={current===0}>Previous</button>{canSubmit?<button type="submit">Submit exam</button>:atEnd&&hasOtherUnanswered?<button type="button" onClick={next}>Next unanswered</button>:atEnd?<button type="button" disabled>Answer to finish</button>:<button type="button" onClick={next}>Next</button>}</div>
          {!canSubmit&&<span className="exam-unanswered-note">{questions.length-answeredCount} question{questions.length-answeredCount===1?'':'s'} remaining before submit.</span>}
        </div>
      </>:<>{questions.map((q,index)=><section className="card exam-question" key={q.id}><p className="question-progress">Question {index+1} of {questions.length}</p><h2>{q.prompt}</h2>{q.choices.map(c=><label className={`answer ${answers[q.id]===c.id?'answer-selected':''}`} key={c.id}><input type="radio" name={`visible_${q.id}`} checked={answers[q.id]===c.id} onChange={()=>choose(q.id,c.id)}/><span>{c.label}</span></label>)}</section>)}<button type="submit" disabled={!canSubmit}>Submit exam</button>{!canSubmit&&<p className="exam-unanswered-note">Answer all questions before submitting.</p>}</>}
    </form>
  </main>
}
