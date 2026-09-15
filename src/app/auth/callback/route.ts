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
function allowedStudentDomains(){
  return String(process.env.CRAMLOOP_GOOGLE_STUDENT_DOMAINS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const target = safeRedirectTarget(requestUrl.searchParams.get('next'),requestUrl.origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const domains=allowedStudentDomains()
      if(domains.length>0){
        const{data:{user}}=await supabase.auth.getUser()
        if(user){
          const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
          if(profile?.role==='student'){
            const domain=String(user.email||'').split('@')[1]?.toLowerCase()||''
            if(!domains.includes(domain)){
              await supabase.auth.signOut()
              const message='Student access requires an approved school-managed Google Workspace account.'
              return NextResponse.redirect(new URL('/login?error='+encodeURIComponent(message),requestUrl.origin))
            }
          }
        }
      }
      return NextResponse.redirect(target)
    }
  }

  return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('Sign-in verification failed or expired. Please try again.'), requestUrl.origin))
}
