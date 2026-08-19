import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeRedirectTarget(value:string|null,origin:string){
  if(!value)return new URL('/dashboard',origin)
  try{
    const target=new URL(value,origin)
    if(target.origin!==origin)return new URL('/dashboard',origin)
    return target
  }catch{
    return new URL('/dashboard',origin)
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const target = safeRedirectTarget(requestUrl.searchParams.get('next'),requestUrl.origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(target)
  }

  return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('Email verification failed or expired. Please try signing in or request a new verification email.'), requestUrl.origin))
}
