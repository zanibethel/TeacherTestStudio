'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import './focus.css'

type FocusQuestion={question_id:string;question_position:number;prompt:string;content_area:string|null;choices:string[];focused_retake_hint:string|null;previous_answer:string|null}
type Props={title:string;questions:FocusQuestion[];showHints:boolean;required:boolean;minScore:number;action:(formData:FormData)=>void}

export default function FocusPracticeRunner({title,questions,showHints,required,minScore,action}:Props){
  const[current,setCurrent]=useState(0)
  const[answers,setAnswers]=useState<Record<string,number>>({})
  const[openHint,setOpenHint]=useState<string|null>(null)
  const stripRef=useRef<HTMLDivElement>(null)
  const touchStart=useRef<{x:number;y:number}|null>(null)
  const answeredCount=useMemo(()=>Object.keys(answers).length,[answers])
  const question=questions[current]
  const unanswered=questions.map((q,i)=>answers[q.question_id]===undefined?i:-1).filter(i=>i>=0)

  useEffect(()=>{
    const button=stripRef.current?.querySelector<HTMLButtonElement>(`button[data-index="${current}"]`)
    button?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})
    setOpenHint(null)
  },[current])

  function choose(index:number){setAnswers(prev=>({...prev,[question.question_id]:index}))}
  function previous(){setCurrent(i=>Math.max(0,i-1))}
  function next(){
    if(current<questions.length-1){setCurrent(i=>i+1);return}
    const nextOpen=unanswered.find(i=>i!==current)
    if(nextOpen!==undefined)setCurrent(nextOpen)
  }
  function onTouchStart(e:React.TouchEvent){const t=e.touches[0];touchStart.current={x:t.clientX,y:t.clientY}}
  function onTouchEnd(e:React.TouchEvent){
    const start=touchStart.current;if(!start)return
    const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;touchStart.current=null
    if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.25)return
    if(dx<0)next();else previous()
  }
  const atEnd=current===questions.length-1
  const allAnswered=answeredCount===questions.length
  const nextLabel=atEnd&&!allAnswered?'Next unanswered':atEnd?'Review & submit':'Next'

  return <main className="focus-shell">
    <header className="focus-topbar"><div><span className="eyebrow">Focused retest</span><h1>{title}</h1></div><div className="focus-progress"><b>{answeredCount}/{questions.length}</b><span>answered</span></div></header>
    <div className="focus-ruleline">{required?(minScore===0?'Completion unlocks the next full attempt':`${minScore}% required to unlock the next full attempt`):'Focused practice'}</div>
    <form action={action} className="focus-form">
      {questions.map(q=><input key={q.question_id} type="hidden" name={`q_${q.question_id}`} value={answers[q.question_id]??''}/>) }
      <section className="focus-question" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="focus-question-meta"><span>Question {current+1} of {questions.length}</span>{question.content_area&&<span>{question.content_area}</span>}</div>
        <h2>{question.prompt}</h2>
        {question.previous_answer&&<div className="focus-previous-answer"><span>Previous answer</span><b>{question.previous_answer}</b></div>}
        {showHints&&question.focused_retake_hint&&<div className="focus-hint-wrap"><button type="button" className="focus-hint-button" onClick={()=>setOpenHint(openHint===question.question_id?null:question.question_id)}>{openHint===question.question_id?'Hide hint':'Show hint'}</button>{openHint===question.question_id&&<p className="focus-hint">{question.focused_retake_hint}</p>}</div>}
        <div className="focus-answers">{question.choices.map((choice,i)=><label key={i} className={`focus-answer ${answers[question.question_id]===i?'selected':''}`}><input type="radio" checked={answers[question.question_id]===i} onChange={()=>choose(i)}/><span>{choice}</span></label>)}</div>
      </section>
      <div className="focus-dock">
        <div className="focus-number-strip" ref={stripRef}>{questions.map((q,i)=><button data-index={i} type="button" key={q.question_id} className={`${i===current?'current':''} ${answers[q.question_id]!==undefined?'answered':''}`} onClick={()=>setCurrent(i)}>{i+1}</button>)}</div>
        <div className="focus-nav"><button type="button" className="secondary" onClick={previous} disabled={current===0}>Previous</button>{atEnd&&allAnswered?<button type="submit">Submit focused retest</button>:<button type="button" onClick={next}>{nextLabel}</button>}</div>
        {!allAnswered&&atEnd&&<span className="focus-unanswered">{unanswered.length} unanswered · Next jumps to the next one</span>}
      </div>
    </form>
  </main>
}
