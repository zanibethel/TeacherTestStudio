'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://cramloop.app'

function safeNext(value:FormDataEntryValue|null){
  const next=String(value??'').trim()
  return next.startsWith('/')&&!next.startsWith('//')?next:'/dashboard'
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
  const email = String(fd.get('email'))
  const password = String(fd.get('password'))
  const full_name = String(fd.get('full_name'))
  const requested_role = fd.get('role') === 'teacher' ? 'teacher' : 'student'
  const teacher_invite = String(fd.get('teacher_invite') ?? '').trim().toUpperCase()
  const next=safeNext(fd.get('next'))
  if (requested_role === 'teacher' && !teacher_invite) redirect('/login?error=' + encodeURIComponent('Teacher accounts require a private invite from an approved teacher.'))
  const { data, error } = await s.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback${next!=='/dashboard'?`?next=${encodeURIComponent(next)}`:''}`,
      data: { full_name, requested_role, teacher_invite },
    },
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message) + (next!=='/dashboard'?'&next='+encodeURIComponent(next):''))
  if (!data.session) redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account, then sign in.') + (next!=='/dashboard'?'&next='+encodeURIComponent(next):''))
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
