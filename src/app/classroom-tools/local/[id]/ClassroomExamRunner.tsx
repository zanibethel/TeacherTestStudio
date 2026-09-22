'use client'

import {useEffect} from 'react'
import type {ComponentProps} from 'react'
import FocusPracticeRunner from '@/app/practice/[id]/FocusPracticeRunner'
import './classroom.css'

export default function ClassroomExamRunner(props:ComponentProps<typeof FocusPracticeRunner>){
  useEffect(()=>{
    document.body.classList.add('local-classroom-active')
    return()=>document.body.classList.remove('local-classroom-active')
  },[])

  return <FocusPracticeRunner {...props}/>
}
