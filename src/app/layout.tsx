import './globals.css'; import Link from 'next/link'
export const metadata={title:'Teacher Test Studio',description:'Reusable tests, student scoring, and teacher reporting'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><header><div><Link href="/"><b>Teacher Test Studio</b></Link><Link href="/dashboard">Dashboard</Link></div></header>{children}</body></html>}
