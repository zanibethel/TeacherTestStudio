'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin') || 'https://teacher-test-studio.vercel.app'
  const { data, error } = await s.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name, requested_role },
    },
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  if (!data.session) redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account, then sign in.'))
  redirect('/dashboard')
}
