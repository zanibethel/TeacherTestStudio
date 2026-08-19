'use server'
import { redirect } from 'next/navigation'
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
  const requireFocusedRetake = formData.get('require_focused_retake_before_full') === 'on'
  let questions: unknown
  try { questions = JSON.parse(String(formData.get('questions') ?? '[]')) } catch { redirect('/tests/new?error=Invalid+question+data') }
  const { data, error } = await supabase.rpc('create_test_with_questions_v4', {
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
    p_require_focused_retake_before_full: requireFocusedRetake,
  })
  if (error) redirect('/tests/new?error=' + encodeURIComponent(error.message))
  redirect(`/tests/${data}`)
}
