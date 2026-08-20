import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {generateAlternateVersion} from '../version-actions'

export default async function TestPreview({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{created?:string,error?:string,source?:string}>}){
 const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const{data:test}=await supabase.from('tests').select('id,teacher_id,title,description,status,duration_minutes,passing_score_percent,one_question_per_page,randomize_questions,randomize_choices,questions_per_attempt,questions(id,prompt,position,choices(id,label,position))').eq('id',id).single();if(!test||test.teacher_id!==user.id)notFound()
 const questions=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position)
 const fullCount=test.questions_per_attempt||questions.length
 const justCreated=Boolean(query.created)
 const createdLabel=query.created==='blueprint'?'Fresh test generated from your blueprint.':query.created==='alternate'?'Fresh alternate version generated.':'Test created.'
 const statusLabel=test.status==='published'?'Published':'Archived'
 const assignHref=`/assignments/new?test=${id}`
 return <main>
  <div className="row between" style={{alignItems:'flex-end',gap:12,flexWrap:'wrap',marginBottom:12}}><div><Link href="/dashboard">← Tests</Link><h1 style={{margin:'10px 0 2px'}}>Preview</h1><p className="muted" style={{margin:0}}>Check the student view, then edit or assign.</p></div><Link href={assignHref}>Create assignment →</Link></div>
  {query.error&&<p className="bad notice">{query.error}</p>}
  {justCreated&&<div className="notice" style={{padding:'10px 14px'}}><b>{createdLabel}</b>{query.created==='alternate'&&query.source&&<span className="muted"> · <Link href={`/tests/${query.source}/preview`}>View source version</Link></span>}</div>}

  <section className="card" style={{padding:'18px 20px'}}>
    <div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'nowrap'}}><div style={{minWidth:0}}><h2 style={{margin:'0 0 3px',fontSize:26}}>{test.title}</h2><small style={{fontWeight:750,color:test.status==='published'?'#3730a3':'#64748b'}}>{statusLabel}</small>{test.description&&<p style={{margin:'8px 0 0'}}>{test.description}</p>}</div><Link className="button" style={{padding:'9px 12px',whiteSpace:'nowrap'}} href={assignHref}>Assign</Link></div>
    <p style={{margin:'16px 0 4px',fontWeight:750}}>{questions.length} questions · {fullCount} shown · {test.duration_minutes?`${test.duration_minutes} min`:'Untimed'} · {test.passing_score_percent}% pass</p>
    <p className="muted" style={{margin:0}}>{test.one_question_per_page?'One question per page':'Continuous'} · {test.randomize_questions?'Random question order':'Fixed question order'} · {test.randomize_choices?'Random choices':'Fixed choices'}</p>
  </section>

  <section className="card" style={{padding:'14px 18px'}}><div className="row between" style={{gap:10,alignItems:'center'}}><div className="row" style={{gap:8}}><form action={generateAlternateVersion.bind(null,id)}><button className="secondary" style={{padding:'8px 11px'}} type="submit">↻ New version</button></form><Link className="secondary button" style={{padding:'8px 11px'}} href={`/tests/${id}/edit`}>✎ Edit</Link></div><Link className="button" style={{padding:'8px 12px'}} href={assignHref}>Assign →</Link></div></section>

  <div style={{margin:'22px 2px 10px'}}><h2 style={{margin:'0 0 2px'}}>Student view</h2><p className="muted" style={{margin:0}}>Preview only — no attempt is created and answers are not shown.</p></div>
  {questions.map((question:any,index:number)=>{const choices=[...(question.choices??[])].sort((a:any,b:any)=>a.position-b.position);return <section className="card" style={{padding:'20px'}} key={question.id}><h2 style={{fontSize:24,lineHeight:1.3,margin:'0 0 16px'}}>{index+1}. {question.prompt}</h2><div style={{display:'grid',gap:8}}>{choices.map((choice:any)=><label className="check" style={{gap:10,padding:'8px 0'}} key={choice.id}><input type="radio" disabled name={`preview_${question.id}`}/><span>{choice.label}</span></label>)}</div></section>})}
  <section className="card" style={{padding:'14px 18px'}}><div className="row between" style={{gap:10}}><b>Looks right?</b><div className="row" style={{gap:8}}><Link className="secondary button" style={{padding:'8px 11px'}} href={`/tests/${id}/edit`}>Edit</Link><Link className="button" style={{padding:'8px 12px'}} href={assignHref}>Create assignment →</Link></div></div></section>
 </main>
}
