import Link from 'next/link'
import { login, signup, requestPasswordReset } from './actions'

export default async function Login({searchParams}:{searchParams:Promise<{error?:string,message?:string,role?:string,invite?:string,email?:string,next?:string}>}){
  const q=await searchParams
  const invitedTeacher=q.role==='teacher'&&Boolean(q.invite)
  const next=q.next?.startsWith('/')&&!q.next.startsWith('//')?q.next:'/dashboard'

  if(invitedTeacher){
    return <main className="narrow"><Link href="/">← Home</Link><h1>Invited teacher signup</h1><p className="muted">This private invitation is bound to the teacher email chosen by the inviter.</p>{q.error&&<p className="bad notice">{q.error}</p>}{q.message&&<p className="good notice">{q.message}</p>}<form className="card stack"><input type="hidden" name="next" value={next}/><input type="hidden" name="role" value="teacher"/><input type="hidden" name="teacher_invite" value={q.invite}/><label>Name</label><input name="full_name" required/><label>Email</label><input name="email" type="email" required autoComplete="email" defaultValue={q.email||''}/><label>Password</label><input name="password" type="password" required minLength={6}/><div className="notice"><b>Teacher invitation</b><p className="muted">Use the email this invitation was created for. The link expires after 7 days and works once.</p></div><button formAction={signup}>Create teacher account</button></form></main>
  }

  return <main className="narrow"><Link href="/">← Home</Link><h1>Sign in</h1><p className="muted">Access your CramLoop tests, assignments, practice, and reports.</p>{q.error&&<p className="bad notice">{q.error}</p>}{q.message&&<p className="good notice">{q.message}</p>}
    <form className="card stack"><input type="hidden" name="next" value={next}/><label>Email</label><input name="email" type="email" required autoComplete="email"/><label>Password</label><input name="password" type="password" required minLength={6} autoComplete="current-password"/>{next.startsWith('/share/')&&<p className="good notice">After signing in, you’ll return directly to this shared assignment.</p>}<div className="row" style={{alignItems:'center',flexWrap:'wrap',gap:12}}><button formAction={login}>Sign in</button><button className="link-button" formAction={requestPasswordReset} style={{fontSize:14,padding:0}}>Forgot password?</button></div></form>
    <section className="card"><h2>New student?</h2><p className="muted">Create your student account, add your name, and optionally connect with your teacher.</p><Link className="secondary button" href={`/signup/student${next!=='/dashboard'?`?next=${encodeURIComponent(next)}`:''}`}>Create student account</Link></section>
  </main>
}
