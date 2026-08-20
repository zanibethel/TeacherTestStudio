'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createTest(formData: FormData) {
  const supabase = await createClient()
  const title = String(formData.get('title') ?? '')
  const description = String(formData.get('description') ?? '')
  const randomize = formData.get('randomize') === 'on'
  const duration = Number(formData.get('duration_minutes') ?? 120)
  const passingScore = Number(formData.get('passing_score') ?? 70)
  const singlePage = formData.get('single_page') === 'on'
  const examPreset = String(formData.get('exam_preset') ?? 'custom')
  const assessmentType = String(formData.get('assessment_type') ?? 'custom')
  const chapterLabel = String(formData.get('chapter_label') ?? '')
  const questionsPerAttempt = Number(formData.get('questions_per_attempt') ?? 0)
  let questions: unknown
  try { questions = JSON.parse(String(formData.get('questions') ?? '[]')) } catch { redirect('/tests/new?error=Invalid+question+data') }
  const { data, error } = await supabase.rpc('create_test_with_questions_v6', {
    p_title: title,
    p_description: description,
    p_randomize: randomize,
    p_duration_minutes: duration,
    p_one_question_per_page: singlePage,
    p_passing_score: passingScore,
    p_exam_preset: examPreset,
    p_assessment_type: assessmentType,
    p_chapter_label: chapterLabel,
    p_questions: questions,
    p_questions_per_attempt: questionsPerAttempt > 0 ? questionsPerAttempt : null,
    p_require_focused_retake_before_full: false,
    p_focused_retake_percent: 50,
    p_focused_retake_min_score: 0,
    p_focused_retake_hints: true,
    p_unlimited_attempts_until_due: false,
    p_max_attempts: 1,
    p_due_at: null,
  })
  if (error) redirect('/tests/new?error=' + encodeURIComponent(error.message))
  redirect(`/tests/${data}/preview?created=1`)
}

export async function saveSubjectMixPreset(name: string, weights: Record<string, number>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in again before saving a preset.' }
  const { data: profile } = await supabase.from('profiles').select('role,teacher_approved').eq('id', user.id).single()
  if (profile?.role !== 'teacher' || !profile.teacher_approved) return { ok: false, error: 'Teacher access is required.' }
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 80) return { ok: false, error: 'Preset name must be between 1 and 80 characters.' }
  const clean = Object.fromEntries(Object.entries(weights).map(([key, value]) => [key.trim(), Number(value)]).filter(([key, value]) => key && Number.isFinite(value) && value >= 0 && value <= 100)) as Record<string, number>
  const total = Object.values(clean).reduce((sum, value) => sum + value, 0)
  if (!Object.keys(clean).length || Math.round(total) !== 100) return { ok: false, error: `Preset percentages must total 100%. Current total: ${total}%.` }
  const payload = { teacher_id: user.id, name: cleanName, subject_weights: clean, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('teacher_subject_mix_presets').upsert(payload, { onConflict: 'teacher_id,name' }).select('id,name,subject_weights').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/tests/new')
  return { ok: true, preset: data }
}
