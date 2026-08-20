'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://cramloop.app'

function safeNext(value:FormDataEntryValue|null){
  const next=String(value??'').trim()
  return next.startsWith('/')&&!next.startsWith('//')?next:'/dashboard'
}
function invitedTeacherUrl(invite:string,email:string,message:string,key:'error'|'message'='error'){
  const q=new URLSearchParams({role:'teacher',invite,email,[key]:message})
  return '/login?'+q.toString()
}

export async function login(fd: FormData) {
  const s = await createClient()
  const email = String(fd.get('email'))
  const password = String(fd.get('password'))
  const next=safeNext(fd.get('next'))
  const { error } = await s.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message) + (next!=='/dashboard'?'&next='+encodeURIComponent(next):''))
  redirect(next)
}

export async function signup(fd: FormData) {
  const s = await createClient()
  const email = String(fd.get('email')).trim().toLowerCase()
  const password = String(fd.get('password'))
  const full_name = String(fd.get('full_name')||'').trim()
  const requested_role = fd.get('role') === 'teacher' ? 'teacher' : 'student'
  const teacher_invite = String(fd.get('teacher_invite') ?? '').trim().toUpperCase()
  const requested_teacher_id = String(fd.get('requested_teacher_id') ?? '').trim()
  const next=safeNext(fd.get('next'))
  if (!full_name) redirect((requested_role==='student'?'/signup/student':'/login')+'?error='+encodeURIComponent('Enter your name.'))
  if (requested_role === 'teacher'){
    if(!teacher_invite)redirect('/login?error=' + encodeURIComponent('Teacher accounts require a private invite from an approved teacher.'))
    const{data:inviteMatches,error:inviteError}=await s.rpc('teacher_invite_matches',{p_code:teacher_invite,p_email:email})
    if(inviteError||!inviteMatches)redirect(invitedTeacherUrl(teacher_invite,email,'This teacher invite is expired, already used, or was created for a different email address.'))
  }
  const { data, error } = await s.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback${next!=='/dashboard'?`?next=${encodeURIComponent(next)}`:''}`,
      data: { full_name, requested_role, teacher_invite, requested_teacher_id:requested_role==='student'?requested_teacher_id:'' },
    },
  })
  if (error){
    if(requested_role==='teacher')redirect(invitedTeacherUrl(teacher_invite,email,error.message))
    redirect('/signup/student?error='+encodeURIComponent(error.message)+(next!=='/dashboard'?'&next='+encodeURIComponent(next):''))
  }
  if (!data.session){
    if(requested_role==='teacher')redirect(invitedTeacherUrl(teacher_invite,email,'Check your email to confirm your account, then sign in.','message'))
    redirect('/login?message=' + encodeURIComponent(requested_teacher_id?'Check your email to confirm your account. Your teacher connection request will be waiting for approval.':'Check your email to confirm your account, then sign in.') + (next!=='/dashboard'?'&next='+encodeURIComponent(next):''))
  }
  redirect(next)
}

export async function requestPasswordReset(fd: FormData) {
  const s = await createClient()
  const email = String(fd.get('email') ?? '').trim()
  if (!email) redirect('/login?error=' + encodeURIComponent('Enter your email address first.'))
  const { error } = await s.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/login?message=' + encodeURIComponent('If an account exists for that email, a password reset link has been sent.'))
}
