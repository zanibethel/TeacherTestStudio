import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import ReportsBrowser from './ReportsBrowser'

export default async function ReportsIndex(){
 const supabase=await createClient()
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
 if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const{data:shares}=await supabase.from('test_shares').select('id,test_id,label,experience_name,created_at,due_at,active,delivery_mode,audience_mode,max_attempts,unlimited_attempts_until_due,require_focused_retake_before_full,focused_retake_percent,focused_retake_min_score,focused_retake_hints,study_guide_enabled,randomized_retest_enabled,restricted_mode,link_expires_at,test:tests(id,title)').eq('teacher_id',user.id).order('created_at',{ascending:false})
 const shareIds=(shares??[]).map((s:any)=>s.id)
 const[{data:attempts},{data:groupTargets},{data:rosterTargets},{data:groups},{data:roster},{data:groupMembers}]=await Promise.all([
  shareIds.length?supabase.from('attempts').select('id,share_id,student_id,started_at,submitted_at,score_percent,correct_count,total_questions,attempt_number,integrity_violation_count,auto_submitted,student:profiles!attempts_student_id_fkey(full_name)').in('share_id',shareIds):Promise.resolve({data:[] as any[]}),
  shareIds.length?supabase.from('test_share_group_targets').select('share_id,group_id').in('share_id',shareIds):Promise.resolve({data:[] as any[]}),
  shareIds.length?supabase.from('test_share_roster_targets').select('share_id,roster_id').in('share_id',shareIds):Promise.resolve({data:[] as any[]}),
  supabase.from('teacher_groups').select('id,name').eq('teacher_id',user.id).order('name'),
  supabase.from('teacher_student_roster').select('id,student_email,student_id,student_first_name,student_last_name').eq('teacher_id',user.id).order('student_email'),
  supabase.from('teacher_group_members').select('group_id,roster_id')
 ])
 const groupById=new Map((groups??[]).map((g:any)=>[g.id,g]))
 const rosterById=new Map((roster??[]).map((r:any)=>[r.id,r]))
 const rosterByStudentId=new Map((roster??[]).filter((r:any)=>r.student_id).map((r:any)=>[r.student_id,r]))
 const memberRosterByGroup=new Map<string,string[]>();for(const m of groupMembers??[]){memberRosterByGroup.set((m as any).group_id,[...(memberRosterByGroup.get((m as any).group_id)||[]),(m as any).roster_id])}
 const groupIdsByShare=new Map<string,string[]>();for(const t of groupTargets??[]){groupIdsByShare.set((t as any).share_id,[...(groupIdsByShare.get((t as any).share_id)||[]),(t as any).group_id])}
 const rosterIdsByShare=new Map<string,string[]>();for(const t of rosterTargets??[]){rosterIdsByShare.set((t as any).share_id,[...(rosterIdsByShare.get((t as any).share_id)||[]),(t as any).roster_id])}
 const attemptsByShare=new Map<string,any[]>();for(const a of attempts??[]){attemptsByShare.set((a as any).share_id,[...(attemptsByShare.get((a as any).share_id)||[]),a])}
 const rosterLabel=(r:any)=>{const name=[r?.student_first_name,r?.student_last_name].filter(Boolean).join(' ').trim();return name?`${name} · ${r.student_email}`:r?.student_email||'Student'}
 const reports=(shares??[]).map((share:any)=>{
  const test=Array.isArray(share.test)?share.test[0]:share.test
  const groupIds=groupIdsByShare.get(share.id)||[]
  const groupNames=groupIds.map(id=>groupById.get(id)?.name).filter(Boolean) as string[]
  const assignedRoster=new Set(rosterIdsByShare.get(share.id)||[]);for(const gid of groupIds)for(const rid of memberRosterByGroup.get(gid)||[])assignedRoster.add(rid)
  const shareAttempts=attemptsByShare.get(share.id)||[]
  const studentRefs=new Set<string>();const studentLabels=new Set<string>();const resultMap=new Map<string,any>()
  for(const rid of assignedRoster){const r=rosterById.get(rid);if(!r)continue;studentRefs.add(`roster:${rid}`);if(r.student_id)studentRefs.add(`student:${r.student_id}`);studentLabels.add(rosterLabel(r));resultMap.set(`roster:${rid}`,{key:`roster:${rid}`,label:rosterLabel(r),accessed:false,completed:false,best:null,attempts:[]})}
  for(const a of shareAttempts){const student=Array.isArray(a.student)?a.student[0]:a.student;const rosterRow=a.student_id?rosterByStudentId.get(a.student_id):null;const key=rosterRow?`roster:${rosterRow.id}`:`student:${a.student_id||a.id}`;const label=rosterRow?rosterLabel(rosterRow):(student?.full_name||'Student');if(rosterRow)studentRefs.add(`roster:${rosterRow.id}`);if(a.student_id)studentRefs.add(`student:${a.student_id}`);studentLabels.add(label);const row=resultMap.get(key)||{key,label,accessed:false,completed:false,best:null,attempts:[]};row.accessed=true;if(a.submitted_at){row.completed=true;const score=Number(a.score_percent||0);row.best=row.best===null?score:Math.max(row.best,score)}row.attempts.push({id:a.id,attemptNumber:a.attempt_number||1,submittedAt:a.submitted_at,score:a.score_percent===null?null:Number(a.score_percent),correct:a.correct_count,total:a.total_questions,integrity:a.integrity_violation_count||0,autoSubmitted:Boolean(a.auto_submitted)});resultMap.set(key,row)}
  const students=[...resultMap.values()].sort((a,b)=>a.label.localeCompare(b.label))
  return{id:share.id,testId:share.test_id,testTitle:test?.title||'Untitled test',label:share.label||'Untitled assignment',experienceName:share.experience_name||null,createdAt:share.created_at,dueAt:share.due_at,active:Boolean(share.active),deliveryMode:share.delivery_mode||'standard',audienceMode:share.audience_mode||'link',maxAttempts:share.max_attempts||1,unlimited:Boolean(share.unlimited_attempts_until_due),focusedRequired:Boolean(share.require_focused_retake_before_full),focusedPercent:share.focused_retake_percent??50,focusedMin:share.focused_retake_min_score??0,focusedHints:Boolean(share.focused_retake_hints),studyGuide:Boolean(share.study_guide_enabled),randomizedRetest:Boolean(share.randomized_retest_enabled),restricted:Boolean(share.restricted_mode),linkExpiresAt:share.link_expires_at,groupIds,groupNames,studentRefs:[...studentRefs],studentLabels:[...studentLabels],students}
 })
 const testOptions=[...new Map(reports.map(r=>[r.testId,{value:r.testId,label:r.testTitle}])).values()]
 const groupOptions=(groups??[]).map((g:any)=>({value:g.id,label:g.name}))
 const studentOptions:any[]=[];const seenStudents=new Set<string>();for(const r of roster??[]){const value=`roster:${(r as any).id}`;seenStudents.add(value);studentOptions.push({value,label:rosterLabel(r)})}for(const a of attempts??[]){if(!(a as any).student_id)continue;const rosterRow=rosterByStudentId.get((a as any).student_id);if(rosterRow)continue;const value=`student:${(a as any).student_id}`;if(seenStudents.has(value))continue;const student=Array.isArray((a as any).student)?(a as any).student[0]:(a as any).student;seenStudents.add(value);studentOptions.push({value,label:student?.full_name||'Student'})}studentOptions.sort((a,b)=>a.label.localeCompare(b.label))
 return <main>
  <div className="row between"><div><Link href="/dashboard">← My tests</Link><h1>Reports</h1><p className="muted">Assignment reports are listed from most recently shared to oldest. Search or filter by test, assignment, group, or student and the report list updates immediately.</p></div></div>
  <ReportsBrowser reports={reports as any} tests={testOptions} groups={groupOptions} students={studentOptions}/>
 </main>
}
