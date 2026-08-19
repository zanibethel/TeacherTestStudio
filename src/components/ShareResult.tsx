'use client'

import { useState } from 'react'

const SITE_URL='https://cramloop.app'

export default function ShareResult({score,title,passingScore}:{score:number;title:string;passingScore:number}){
  const [status,setStatus]=useState('')
  const passed=score>=passingScore
  const text=passed
    ? `I used CramLoop to practice and passed ${title} with ${score}%! Think you can beat my score? Try a practice test.`
    : `I used CramLoop to practice ${title} and scored ${score}%. I’m working on improving my skills — try a practice test too.`
  const url=`${SITE_URL}/practice-library?utm_source=result_share&utm_medium=student_referral`

  async function share(){
    try{
      if(navigator.share){
        await navigator.share({title:'CramLoop practice result',text,url})
        setStatus('Shared!')
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setStatus('Share message copied!')
    }catch(err:any){
      if(err?.name!=='AbortError')setStatus('Could not share. Try copying the link.')
    }
  }

  async function copy(){
    try{await navigator.clipboard.writeText(`${text} ${url}`);setStatus('Share message copied!')}
    catch{setStatus('Could not copy. Try Share result instead.')}
  }

  return <section className="card">
    <h2>Share your progress</h2>
    <p className="muted">Invite a friend to try CramLoop too. Your email, answers, teacher information, and detailed attempt data are never included.</p>
    <div className="notice"><b>{text}</b></div>
    <div className="row" style={{marginTop:12}}><button type="button" onClick={share}>Share result</button><button type="button" className="secondary" onClick={copy}>Copy message</button></div>
    {status&&<p className="good">{status}</p>}
  </section>
}
