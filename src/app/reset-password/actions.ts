'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updatePassword(fd: FormData) {
  const supabase = await createClient()
  const password = String(fd.get('password') ?? '')
  const confirm = String(fd.get('confirm_password') ?? '')
  if (password.length < 8) redirect('/reset-password?error=' + encodeURIComponent('Password must be at least 8 characters.'))
  if (password !== confirm) redirect('/reset-password?error=' + encodeURIComponent('Passwords do not match.'))
  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/reset-password?error=' + encodeURIComponent(error.message))
  await supabase.auth.signOut()
  redirect('/login?message=' + encodeURIComponent('Password updated. Sign in with your new password.'))
}
