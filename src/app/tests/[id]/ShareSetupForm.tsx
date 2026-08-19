'use client'

import {useMemo,useState} from 'react'
import AudiencePicker from './AudiencePicker'
import styles from './ShareSetupForm.module.css'

type RosterRow={id:string;student_email:string;student_id:string|null}
type GroupRow={id:string;name:string;member_count:number}
type SavedPreset={id:string;name:string;settings:any}
type Settings={
  deliveryMode:'standard'|'restricted'
  maxAttempts:number
  unlimited:boolean
  requireFocused:boolean
  focusedPercent:number
  focusedMinScore:number
  focusedHints:boolean
  studyGuide:boolean
  focusedRetake:boolean
  paidAccess:boolean
  accessDuration:number
  price:string
}

type Option={key:string;name:string;settings:Settings;saved?:boolean}

const STANDARD:Settings={deliveryMode:'standard',maxAttempts:2,unlimited:false,requireFocused:false,focusedPercent:50,focusedMinScore:0,focusedHints:true,studyGuide:false,focusedRetake:false,paidAccess:false,accessDuration:14,price:''}
const RESTRICTED:Settings={deliveryMode:'restricted',maxAttempts:1,unlimited:false,requireFocused:false,focusedPercent:50,focusedMinScore:0,focusedHints:false,studyGuide:false,focusedRetake:false,paidAccess:false,accessDuration:14,price:''}
const STUDY:Settings={deliveryMode:'standard',maxAttempts:3,unlimited:false,requireFocused:false,focusedPercent:50,focusedMinScore:0,focusedHints:true,studyGuide:true,focusedRetake:true,paidAccess:false,accessDuration:14,price:''}
const PAID:Settings={deliveryMode:'standard',maxAttempts:1,unlimited:false,requireFocused:false,focusedPercent:50,focusedMinScore:0,focusedHints:true,studyGuide:true,focusedRetake:true,paidAccess:true,accessDuration:14,price:''}

function normalizedSettings(value:any):Settings{
  return {
    deliveryMode:value?.deliveryMode==='restricted'?'restricted':'standard',
    maxAttempts:Math.max(1,Math.min(100,Number(value?.maxAttempts??2))),
    unlimited:Boolean(value?.unlimited),
    requireFocused:Boolean(value?.requireFocused),
    focusedPercent:Math.max(10,Math.min(100,Number(value?.focusedPercent??50))),
    focusedMinScore:Math.max(0,Math.min(100,Number(value?.focusedMinScore??0))),
    focusedHints:value?.focusedHints!==false,
    studyGuide:Boolean(value?.studyGuide),
    focusedRetake:Boolean(value?.focusedRetake),
    paidAccess:Boolean(value?.paidAccess),
    accessDuration:Math.max(1,Math.min(365,Number(value?.accessDuration??14))),
    price:String(value?.price??''),
  }
}

export default function ShareSetupForm({roster,groups,presets,proActive,fullQuestionCount}:{roster:RosterRow[];groups:GroupRow[];presets:SavedPreset[];proActive:boolean;fullQuestionCount:number}){
  const options=useMemo<Option[]>(()=>[
    {key:'standard',name:'Standard test',settings:STANDARD},
    {key:'restricted',name:'Restricted Test Mode + integrity monitoring',settings:RESTRICTED},
    {key:'study',name:'Study mode + study guide + weak-area retake',settings:STUDY},
    {key:'paid',name:'Paid practice access — Pro only',settings:PAID},
    ...presets.map(p=>({key:`saved:${p.id}`,name:p.name,settings:normalizedSettings(p.settings),saved:true})),
  ],[presets])
  const[selectedKey,setSelectedKey]=useState('standard')
  const[settings,setSettings]=useState<Settings>(STANDARD)
  const[savePreset,setSavePreset]=useState(false)
  const[presetName,setPresetName]=useState('')
  const[attemptChoice,setAttemptChoice]=useState('2')
  const[customAttempts,setCustomAttempts]=useState(11)
  const selectedOption=options.find(o=>o.key===selectedKey)
  const experienceName=selectedKey==='custom'?(presetName.trim()||'Custom'):(selectedOption?.name||'Custom')

  function syncAttemptChoice(next:Settings){
    if(next.unlimited){setAttemptChoice('unlimited');return}
    if(next.maxAttempts>=1&&next.maxAttempts<=10){setAttemptChoice(String(next.maxAttempts));return}
    setAttemptChoice('custom');setCustomAttempts(next.maxAttempts)
  }
  function choosePreset(key:string){
    const option=options.find(o=>o.key===key)
    if(!option)return
    setSelectedKey(key);setSettings({...option.settings});setSavePreset(false);setPresetName('');syncAttemptChoice(option.settings)
  }
  function change<K extends keyof Settings>(key:K,value:Settings[K]){
    setSettings(current=>({...current,[key]:value}));setSelectedKey('custom')
  }
  function changeAttemptChoice(value:string){
    setAttemptChoice(value)
    setSelectedKey('custom')
    if(value==='unlimited'){
      setSettings(current=>({...current,unlimited:true}))
      return
    }
    if(value==='custom'){
      setSettings(current=>({...current,unlimited:false,maxAttempts:customAttempts}))
      return
    }
    const count=Number(value)
    setSettings(current=>({...current,unlimited:false,maxAttempts:count}))
  }
  function changeCustomAttempts(value:number){
    const count=Math.max(1,Math.min(100,value||1))
    setCustomAttempts(count)
    setSettings(current=>({...current,unlimited:false,maxAttempts:count}))
    setSelectedKey('custom')
  }
  const focusedCount=Math.max(1,Math.ceil(fullQuestionCount*(settings.focusedPercent/100)))

  return <div className={styles.form}>
    <AudiencePicker roster={roster} groups={groups}/>

    <section className={`${styles.section} ${styles.stepSection}`}>
      <span className="eyebrow">STEP 2</span>
      <h3>Assignment details</h3>
      <div className={styles.twoCol}>
        <div><label>Assignment label <span className="muted">(optional)</span></label><input name="label" placeholder="Period 2 final, Week 1 exam, makeup assignment"/></div>
        <div><label>Due date & time <span className="muted">(optional)</span></label><input name="due_at" type="datetime-local"/><p className={styles.help}>Only required with unlimited attempts.</p></div>
      </div>
    </section>

    <section className={`${styles.section} ${styles.stepSection}`}>
      <span className="eyebrow">STEP 3</span>
      <h3>Testing experience</h3>
      <label>Experience preset</label>
      <select value={selectedKey} onChange={e=>choosePreset(e.target.value)}>
        {options.map(o=><option key={o.key} value={o.key}>{o.saved?`${o.name} · My preset`:o.name}</option>)}
        {selectedKey==='custom'&&<option value="custom">Custom</option>}
      </select>
      <input type="hidden" name="experience_name" value={experienceName}/>
      <p className={styles.help}>Choose the closest setup. Changing a rule below makes it Custom.</p>
    </section>

    {selectedKey==='custom'&&<section className={styles.section}><div><b>Custom experience</b><p className={styles.help}>Use it once or save it as a reusable preset.</p></div><label className={styles.optionRow}><input type="checkbox" checked={savePreset} onChange={e=>setSavePreset(e.target.checked)}/><span><b>Save this experience for later</b></span></label>{savePreset&&<><label>Preset name</label><input name="save_preset_name" value={presetName} onChange={e=>setPresetName(e.target.value)} maxLength={80} placeholder="My weekly remediation setup" required/></>}</section>}

    <section className={styles.section}><h3>Test environment</h3><select name="delivery_mode" value={settings.deliveryMode} onChange={e=>change('deliveryMode',e.target.value as Settings['deliveryMode'])}><option value="standard">Standard test</option><option value="restricted">Restricted Test Mode + integrity monitoring</option></select></section>

    <section className={styles.section}><h3>Full attempts</h3><div className={styles.compactField}><label>Full test attempts</label><select value={attemptChoice} disabled={settings.paidAccess} onChange={e=>changeAttemptChoice(e.target.value)}>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}{n===1?' attempt':' attempts'}</option>)}<option value="unlimited">Unlimited until due date</option><option value="custom">Custom…</option></select>{attemptChoice==='custom'&&<><label>Custom attempt count</label><input name="max_attempts" type="number" min="1" max="100" inputMode="numeric" value={customAttempts} onChange={e=>changeCustomAttempts(Number(e.target.value))}/></>}{attemptChoice!=='custom'&&<input type="hidden" name="max_attempts" value={settings.maxAttempts}/>}<input type="hidden" name="unlimited_attempts_until_due" value={attemptChoice==='unlimited'?'on':''}/><p className={styles.help}>{attemptChoice==='unlimited'?'Students can keep taking fresh full attempts until the due date.':`${settings.maxAttempts} = original attempt${settings.maxAttempts>1?` + ${settings.maxAttempts-1} additional full attempt${settings.maxAttempts-1===1?'':'s'}`:''}.`}</p></div><p className={styles.help}>When another full attempt is allowed, CramLoop builds a fresh retest from the approved pool where possible.</p></section>

    <section className={styles.section}><h3>After a failed full attempt</h3><label className={styles.optionRow}><input type="checkbox" name="require_focused_retake_before_full" checked={settings.requireFocused} onChange={e=>change('requireFocused',e.target.checked)}/><span><b>Require a focused retest before another full attempt</b></span></label><div className={styles.twoCol}><div><label>Focused retest size</label><select name="focused_retake_percent" value={settings.focusedPercent} onChange={e=>change('focusedPercent',Number(e.target.value))}>{[10,20,30,40,50,60,70,80,90,100].map(n=><option key={n} value={n}>{n}% of full test</option>)}</select><p className={styles.help}>About {focusedCount} focused question{focusedCount===1?'':'s'}.</p></div><div><label>Grade required to proceed</label><select name="focused_retake_min_score" value={settings.focusedMinScore} onChange={e=>change('focusedMinScore',Number(e.target.value))}>{Array.from({length:101},(_,n)=><option key={n} value={n}>{n}%{n===0?' · completion only':''}</option>)}</select><p className={styles.help}>{settings.focusedMinScore===0?'Completion alone unlocks the next full attempt.':`${settings.focusedMinScore}% is required to unlock the next full attempt.`}</p></div></div><label className={styles.optionRow}><input type="checkbox" name="focused_retake_hints" checked={settings.focusedHints} onChange={e=>change('focusedHints',e.target.checked)}/><span><b>Show teaching hints on focused retests</b><small>Never shown on the full test. <a href="/help#focused-hints">Learn more</a></small></span></label></section>

    <section className={`${styles.section} ${styles.learningSection}`}><h3>After-test learning <span className="muted">(optional)</span></h3><label className={styles.optionRow}><input type="checkbox" name="study_guide_enabled" checked={settings.studyGuide} onChange={e=>change('studyGuide',e.target.checked)}/><span><b>Study guide</b><small>Show the subjects and concepts that need improvement.</small></span></label><label className={styles.optionRow}><input type="checkbox" name="focused_retake_enabled" checked={settings.focusedRetake} onChange={e=>change('focusedRetake',e.target.checked)}/><span><b>Optional weak-area practice</b><small>Let students practice weak areas even when remediation is not required.</small></span></label></section>

    <details className={`${styles.details} card`}><summary><b>Advanced assignment settings</b></summary><div className={styles.detailsBody}><label>Share-link expiration <span className="muted">(optional)</span></label><input name="link_expires_at" type="datetime-local"/><p className={styles.help}>Usually the due date is enough. Use this only when the link itself should expire separately.</p></div></details>

    <details className={`${styles.details} card`} open={settings.paidAccess}><summary><b>Paid practice access settings</b></summary><div className={styles.detailsBody}><label className={styles.optionRow}><input type="checkbox" name="paid_access" checked={settings.paidAccess} onChange={e=>change('paidAccess',e.target.checked)}/><span><b>Charge students for this practice access</b><small>Pro only</small></span></label><div className={styles.twoCol}><div><label>Access length</label><input name="access_duration_days" type="number" min="1" max="365" value={settings.accessDuration} onChange={e=>change('accessDuration',Number(e.target.value)||14)}/></div><div><label>Price</label><input name="price_dollars" type="number" min="1" step="0.01" value={settings.price} onChange={e=>change('price',e.target.value)} placeholder="12.99"/></div></div><p className={styles.help}>{proActive?'Your account can create paid access. Checkout is not connected yet.':'Teacher Pro is required only when charging students.'}</p></div></details>
  </div>
}
