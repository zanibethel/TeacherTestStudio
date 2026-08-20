import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import BlueprintEditor from '../../BlueprintEditor'
import {saveBlueprint} from '../../actions'

export default async function EditBlueprint({params}:{params:Promise<{id:string}>}){
 const{id}=await params
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const[{data:blueprint},{data:questions}]=await Promise.all([
  supabase.from('teacher_test_blueprints').select('*').eq('id',id).eq('teacher_id',user.id).maybeSingle(),
  supabase.from('question_bank').select('chapter_number,chapter_title,subject_category,content_area').eq('teacher_id',user.id).limit(2000),
 ])
 if(!blueprint)notFound()
 return <main><Link href="/test-blueprints">← Smart-test blueprints</Link><h1>Edit blueprint</h1><BlueprintEditor action={saveBlueprint} questions={(questions??[]) as any} initial={blueprint as any}/></main>
}
