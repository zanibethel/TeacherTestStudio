'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://teacher-test-studio.vercel.app'

export async function login(fd: FormData) {
  const s = await createClient()
  const email = String(fd.get('email'))
  const password = String(fd.get('password'))
  const { error } = await s.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/dashboard')
}

export async function signup(fd: FormData) {
  const s = await createClient()
  const email = String(fd.get('email'))
  const password = String(fd.get('password'))
  const full_name = String(fd.get('full_name'))
  const requested_role = fd.get('role') === 'teacher' ? 'teacher' : 'student'
  const teacher_invite = String(fd.get('teacher_invite') ?? '').trim().toUpperCase()
  if (requested_role === 'teacher' && !teacher_invite) redirect('/login?error=' + encodeURIComponent('Teacher accounts require a private invite from an approved teacher.'))
  const { data, error } = await s.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback`,
      data: { full_name, requested_role, teacher_invite },
    },
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  if (!data.session) redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account, then sign in.'))
  redirect('/dashboard')
}
