# Teacher Test Studio

Reusable classroom testing with teacher/student authentication, share codes, question randomization, automatic grading, review, and teacher reporting.

## Stack
- Next.js 16 App Router
- Supabase Auth + Postgres + Row Level Security
- Vercel

## MVP capabilities
- Teacher/student accounts
- Teacher test library
- Visual multiple-choice test builder (2–6 choices per question)
- Draft/published test lifecycle
- Share codes
- Optional question randomization per student render
- Automatic grading through a protected database function
- Student score + missed-question review
- Teacher per-test attempt reporting and individual response review
- Answer key isolated from student-readable tables with RLS

## Environment
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Local development
```bash
npm install
npm run dev
```

Apply `supabase/migrations/001_initial_schema.sql` to the matching Supabase project before using the app.
