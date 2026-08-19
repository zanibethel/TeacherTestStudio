'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function teacher(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  return{supabase,user}
}

export async function addStudentEmail(fd:FormData){
  const{supabase}=await teacher();const email=String(fd.get('email')||'').trim().toLowerCase();const firstName=String(fd.get('first_name')||'').trim();const lastName=String(fd.get('last_name')||'').trim();const className=String(fd.get('class_name')||'').trim()
  const{data,error}=await supabase.rpc('add_teacher_student_to_roster',{p_email:email,p_first_name:firstName||null,p_last_name:lastName||null,p_class_name:className||null})
  if(error)redirect(`/teacher-roster?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/teacher-roster');revalidatePath('/teacher-groups')
  const groupName=(data as any)?.group_name
  redirect('/teacher-roster?message='+encodeURIComponent(groupName?`Student added to your roster and ${groupName}.`:'Student added to your roster.'))
}

export async function updateStudentRoster(rosterId:string,fd:FormData){
  const{supabase}=await teacher()
  const email=String(fd.get('email')||'').trim().toLowerCase()
  const firstName=String(fd.get('first_name')||'').trim()
  const lastName=String(fd.get('last_name')||'').trim()
  const className=String(fd.get('class_name')||'').trim()
  const groupIds=fd.getAll('group_ids').map(String).filter(Boolean)
  const{data,error}=await supabase.rpc('update_teacher_student_roster',{
    p_roster_id:rosterId,
    p_email:email,
    p_first_name:firstName||null,
    p_last_name:lastName||null,
    p_group_ids:groupIds,
    p_class_name:className||null
  })
  if(error)redirect(`/teacher-roster?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/teacher-roster');revalidatePath('/teacher-groups')
  const groupName=(data as any)?.group_name
  redirect('/teacher-roster?message='+encodeURIComponent(groupName?`Student updated and added to ${groupName}.`:'Student roster entry updated.'))
}

export async function removeStudent(rosterId:string){
  const{supabase}=await teacher();const{error}=await supabase.rpc('remove_teacher_student_roster',{p_roster_id:rosterId})
  if(error)redirect(`/teacher-roster?error=${encodeURIComponent(error.message)}`);revalidatePath('/teacher-roster')
}

export async function createGroup(fd:FormData){
  const{supabase,user}=await teacher();const name=String(fd.get('name')||'').trim();if(!name)redirect('/teacher-roster?error='+encodeURIComponent('Enter a group name.'))
  const{data:existing}=await supabase.from('teacher_groups').select('id,name').eq('teacher_id',user.id).ilike('name',name).maybeSingle();if(existing)redirect('/teacher-roster?error='+encodeURIComponent(`A class named ${existing.name} already exists.`))
  const{data:group,error}=await supabase.from('teacher_groups').insert({teacher_id:user.id,name}).select('id').single();if(error)redirect('/teacher-roster?error='+encodeURIComponent(error.message))
  const rosterIds=fd.getAll('roster_ids').map(String);if(rosterIds.length){const{data:owned}=await supabase.from('teacher_student_roster').select('id').eq('teacher_id',user.id).in('id',rosterIds);const ids=(owned??[]).map((r:any)=>r.id);if(ids.length){const{error:memberError}=await supabase.from('teacher_group_members').insert(ids.map(roster_id=>({group_id:group.id,roster_id})));if(memberError)redirect('/teacher-roster?error='+encodeURIComponent(memberError.message))}}
  revalidatePath('/teacher-roster');revalidatePath('/teacher-groups');redirect('/teacher-roster?message='+encodeURIComponent('Class created.'))
}

export async function saveGroupMembers(groupId:string,fd:FormData){
  const{supabase,user}=await teacher();const{data:group}=await supabase.from('teacher_groups').select('id').eq('id',groupId).eq('teacher_id',user.id).single();if(!group)redirect('/teacher-roster?error='+encodeURIComponent('Class not found.'))
  const{error:delError}=await supabase.from('teacher_group_members').delete().eq('group_id',groupId);if(delError)redirect('/teacher-roster?error='+encodeURIComponent(delError.message))
  const rosterIds=fd.getAll('roster_ids').map(String);if(rosterIds.length){const{data:owned}=await supabase.from('teacher_student_roster').select('id').eq('teacher_id',user.id).in('id',rosterIds);const ids=(owned??[]).map((r:any)=>r.id);if(ids.length){const{error}=await supabase.from('teacher_group_members').insert(ids.map(roster_id=>({group_id:groupId,roster_id})));if(error)redirect('/teacher-roster?error='+encodeURIComponent(error.message))}}
  revalidatePath('/teacher-roster');revalidatePath('/teacher-groups')
}

export async function deleteGroup(groupId:string){
  const{supabase,user}=await teacher();const{error}=await supabase.from('teacher_groups').delete().eq('id',groupId).eq('teacher_id',user.id);if(error)redirect('/teacher-roster?error='+encodeURIComponent(error.message));revalidatePath('/teacher-roster');revalidatePath('/teacher-groups')
}
