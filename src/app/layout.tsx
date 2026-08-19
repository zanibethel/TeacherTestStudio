import './globals.css'
import './nav.css'
import AppHeader from '@/components/AppHeader'

export const metadata={title:'Teacher Test Studio',description:'Reusable tests, student scoring, and teacher reporting'}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><AppHeader/>{children}</body></html>
}
