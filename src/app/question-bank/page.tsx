import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteBankQuestion } from './actions'

export default async function QuestionBank({searchParams}:{searchParams:Promise<{q?:string;area?:string;error?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='teacher')redirect('/dashboard')
  const query=await searchParams;let request=supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,source_type,updated_at').order('updated_at',{ascending:false})
  if(query.q?.trim())request=request.ilike('prompt',`%${query.q.trim()}%`)
  if(query.area?.trim())request=request.eq('content_area',query.area.trim())
  const{data:questions}=await request.limit(500)
  const{data:areas}=await supabase.from('question_bank').select('content_area').not('content_area','is',null)
  const areaList=[...new Set((areas??[]).map((x:any)=>x.content_area).filter(Boolean))].sort()
  return <main><div className="row between"><div><Link href="/dashboard">← Dashboard</Link><h1>Question bank</h1><p className="muted">Reusable questions saved from tests and imports.</p></div><Link className="button" href="/tests/new">+ Build a test</Link></div>{query.error&&<p className="bad">{query.error}</p>}<form className="card" method="get"><div className="settings-grid"><div><label>Search question wording</label><input name="q" defaultValue={query.q??''} placeholder="infection control"/></div><div><label>Content area</label><select name="area" defaultValue={query.area??''}><option value="">All topics</option>{areaList.map(area=><option key={area} value={area}>{area}</option>)}</select></div></div><button>Filter</button></form><p className="muted">{questions?.length??0} saved question{questions?.length===1?'':'s'} shown</p>{!questions?.length?<section className="card"><p className="muted">Your bank is empty. Questions are added automatically when you save a test.</p></section>:questions.map((q:any)=>{const choices=Array.isArray(q.choices)?q.choices:[];return <section className="card" key={q.id}><div className="row between"><div><b>{q.prompt}</b><p className="muted">{q.content_area||'No topic'} · {q.source_type}</p></div><form action={deleteBankQuestion.bind(null,q.id)}><button className="ghost danger">Remove</button></form></div><ol type="A">{choices.map((choice:string,i:number)=><li key={i}><span className={i===q.correct_index?'good':''}>{choice}{i===q.correct_index?' ✓':''}</span></li>)}</ol></section>})}</main>
}
