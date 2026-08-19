'use client'

import {useState} from 'react'

export default function CopyShareLinkButton({url}:{url:string}){
  const[status,setStatus]=useState('')
  async function copy(){
    try{await navigator.clipboard.writeText(url);setStatus('Copied!')}
    catch{setStatus('Copy failed')}
  }
  return <span><button type="button" className="secondary" onClick={copy}>Copy link</button>{status&&<span className="muted" style={{marginLeft:8}}>{status}</span>}</span>
}
