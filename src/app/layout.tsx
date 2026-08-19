import './globals.css'
import './nav.css'
import AppHeader from '@/components/AppHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata={
  title:'CramLoop',
  description:'Practice, improve, and get ready for test day with adaptive practice, teacher tools, and timed cram sessions.',
  metadataBase:new URL('https://cramloop.app'),
}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><AppHeader/>{children}<SiteFooter/></body></html>
}
