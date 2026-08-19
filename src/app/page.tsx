import Link from 'next/link'

export default function Home(){
  return <main className="hero">
    <span className="eyebrow">CRAMLOOP</span>
    <h1>Practice. Improve. Pass it on.</h1>
    <p className="lead">Prepare for test day with teacher-assigned tests, adaptive practice, focused study guides, and short-term Cram Sessions when time is tight.</p>
    <div className="row"><Link className="button" href="/login">Get started</Link><Link className="secondary button-like" href="/login">Student sign in</Link></div>
    <div className="grid three feature-grid">
      <div className="card"><h2>Practice</h2><p>Take randomized tests, free previews, and subject-specific practice bundles.</p></div>
      <div className="card"><h2>Improve</h2><p>See weak areas, build focused mini-tests, and loop back through what needs work.</p></div>
      <div className="card"><h2>Get ready</h2><p>Use teacher assignments or timed Cram Sessions—including 24-hour access when test day is close.</p></div>
    </div>
  </main>
}
