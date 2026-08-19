import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updatePassword } from './actions'

export default async function ResetPassword({searchParams}:{searchParams:Promise<{error?:string}>}){
  const q=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login?error='+encodeURIComponent('Your password reset link is invalid or has expired. Request a new one.'))
  return <main className="narrow"><Link href="/login">← Sign in</Link><h1>Set a new password</h1><p className="muted">Choose a new password for your Teacher Test Studio account.</p>{q.error&&<p className="bad notice">{q.error}</p>}<form action={updatePassword} className="card stack"><label>New password</label><input name="password" type="password" minLength={8} required/><label>Confirm new password</label><input name="confirm_password" type="password" minLength={8} required/><button>Update password</button></form></main>
}
