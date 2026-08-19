import Link from 'next/link'

export default function SiteFooter(){return <footer className="site-footer"><span>© 2026 CramLoop</span><nav aria-label="Support and legal"><Link href="/help">Help & FAQs</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable Use</Link><Link href="/content-disclaimer">Content disclaimer</Link></nav></footer>}
