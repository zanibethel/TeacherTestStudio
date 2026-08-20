'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
async function persistQuestionTags(supabase:any,userId:string,questions:any[]){
  const tagged=questions.filter(q=>q&&String(q.prompt||'').trim()&&(Array.isArray(q.chapters)||Array.isArray(q.subjects)));if(!tagged.length)return
  const prompts=[...new Set(tagged.map(q=>String(q.prompt).trim()))];const{data:bank}=await supabase.from('question_bank').select('id,prompt').eq('teacher_id',userId).in('prompt',prompts);if(!bank?.length)return
  const byPrompt=new Map(bank.map((row:any)=>[normalize(row.prompt),row.id]));const ids=bank.map((row:any)=>row.id);const[{data:chapterRows},{data:subjectRows}]=await Promise.all([supabase.from('question_bank_chapters').select('question_id,chapter_number,chapter_title').in('question_id',ids),supabase.from('question_bank_subjects').select('question_id,subject_category').in('question_id',ids)])
  const chapterKeys=new Set((chapterRows??[]).map((row:any)=>`${row.question_id}|${row.chapter_number??''}|${String(row.chapter_title||'').trim().toLowerCase()}`)),subjectKeys=new Set((subjectRows??[]).map((row:any)=>`${row.question_id}|${String(row.subject_category||'').trim().toLowerCase()}`));const chapters:any[]=[],subjects:any[]=[]
  for(const q of tagged){const questionId=byPrompt.get(normalize(String(q.prompt||'')));if(!questionId)continue;for(const raw of Array.isArray(q.chapters)?q.chapters:[]){const number=raw?.number===null||raw?.number===''?null:Number(raw?.number),title=String(raw?.title||'').trim();if(number===null&&!title)continue;if(number!==null&&(!Number.isInteger(number)||number<1))continue;const key=`${questionId}|${number??''}|${title.toLowerCase()}`;if(!chapterKeys.has(key)){chapterKeys.add(key);chapters.push({question_id:questionId,teacher_id:userId,chapter_number:number,chapter_title:title||null})}}for(const raw of Array.isArray(q.subjects)?q.subjects:[]){const subject=String(raw||'').trim();if(!subject)continue;const key=`${questionId}|${subject.toLowerCase()}`;if(!subjectKeys.has(key)){subjectKeys.add(key);subjects.push({question_id:questionId,teacher_id:userId,subject_category:subject})}}}
  if(chapters.length)await supabase.from('question_bank_chapters').insert(chapters);if(subjects.length)await supabase.from('question_bank_subjects').insert(subjects)
}

export async function createTest(formData: FormData) {
  const supabase = await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const title = String(formData.get('title') ?? ''),description = String(formData.get('description') ?? ''),randomize = formData.get('randomize') === 'on',duration = Number(formData.get('duration_minutes') ?? 120),passingScore = Number(formData.get('passing_score') ?? 70),singlePage = formData.get('single_page') === 'on',examPreset = String(formData.get('exam_preset') ?? 'custom'),assessmentType = String(formData.get('assessment_type') ?? 'custom'),chapterLabel = String(formData.get('chapter_label') ?? ''),questionsPerAttempt = Number(formData.get('questions_per_attempt') ?? 0)
  let questions: any[];try { const parsed=JSON.parse(String(formData.get('questions') ?? '[]'));questions=Array.isArray(parsed)?parsed:[] } catch { redirect('/tests/new?error=Invalid+question+data') }
  const { data, error } = await supabase.rpc('create_test_with_questions_v6', {p_title:title,p_description:description,p_randomize:randomize,p_duration_minutes:duration,p_one_question_per_page:singlePage,p_passing_score:passingScore,p_exam_preset:examPreset,p_assessment_type:assessmentType,p_chapter_label:chapterLabel,p_questions:questions,p_questions_per_attempt:questionsPerAttempt > 0 ? questionsPerAttempt : null,p_require_focused_retake_before_full:false,p_focused_retake_percent:50,p_focused_retake_min_score:0,p_focused_retake_hints:true,p_unlimited_attempts_until_due:false,p_max_attempts:1,p_due_at:null})
  if (error) redirect('/tests/new?error=' + encodeURIComponent(error.message));await persistQuestionTags(supabase,user.id,questions);revalidatePath('/question-bank');revalidatePath('/tests/new');revalidatePath('/dashboard');redirect(`/assignments/new?test=${data}&created_test=1`)
}

export async function saveSubjectMixPreset(name: string, weights: Record<string, number>) {
  const supabase = await createClient();const { data: { user } } = await supabase.auth.getUser();if (!user) return { ok: false, error: 'Sign in again before saving a preset.' }
  const { data: profile } = await supabase.from('profiles').select('role,teacher_approved').eq('id', user.id).single();if (profile?.role !== 'teacher' || !profile.teacher_approved) return { ok: false, error: 'Teacher access is required.' }
  const cleanName = name.trim();if (!cleanName || cleanName.length > 80) return { ok: false, error: 'Preset name must be between 1 and 80 characters.' }
  const clean: Record<string, number> = {};for (const [rawKey, rawValue] of Object.entries(weights)) {const key = rawKey.trim(),value = Number(rawValue);if (key && Number.isFinite(value) && value >= 0 && value <= 100) clean[key] = value}
  const total = Object.values(clean).reduce((sum, value) => sum + value, 0);if (!Object.keys(clean).length || Math.round(total) !== 100) return { ok: false, error: `Preset percentages must total 100%. Current total: ${total}%.` }
  const payload = { teacher_id: user.id, name: cleanName, subject_weights: clean, updated_at: new Date().toISOString() };const { data, error } = await supabase.from('teacher_subject_mix_presets').upsert(payload, { onConflict: 'teacher_id,name' }).select('id,name,subject_weights').single();if (error) return { ok: false, error: error.message };revalidatePath('/tests/new');return { ok: true, preset: data }
}
