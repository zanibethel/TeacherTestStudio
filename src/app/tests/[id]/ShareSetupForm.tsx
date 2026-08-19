'use client'

import {useMemo,useState} from 'react'
import AudiencePicker from './AudiencePicker'

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
  const selectedOption=options.find(o=>o.key===selectedKey)
  const experienceName=selectedKey==='custom'?(presetName.trim()||'Custom'):(selectedOption?.name||'Custom')

  function choosePreset(key:string){
    const option=options.find(o=>o.key===key)
    if(!option)return
    setSelectedKey(key);setSettings({...option.settings});setSavePreset(false);setPresetName('')
  }
  function change<K extends keyof Settings>(key:K,value:Settings[K]){
    setSettings(current=>({...current,[key]:value}));setSelectedKey('custom')
  }
  const focusedCount=Math.max(1,Math.ceil(fullQuestionCount*(settings.focusedPercent/100)))

  return <>
    <AudiencePicker roster={roster} groups={groups}/>

    <section className="notice">
      <span className="eyebrow">STEP 2</span>
      <h3 style={{margin:'4px 0'}}>Assignment details</h3>
      <div className="settings-grid">
        <div><label>Assignment label <span className="muted">(optional)</span></label><input name="label" placeholder="Period 2 final, Week 1 exam, makeup assignment"/></div>
        <div><label>Due date & time <span className="muted">(optional)</span></label><input name="due_at" type="datetime-local"/><p className="muted">Required only if you choose unlimited attempts until the deadline.</p></div>
      </div>
    </section>

    <section className="notice">
      <span className="eyebrow">STEP 3</span>
      <h3 style={{margin:'4px 0'}}>Testing experience</h3>
      <label>Experience preset</label>
      <select value={selectedKey} onChange={e=>choosePreset(e.target.value)}>
        {options.map(o=><option key={o.key} value={o.key}>{o.saved?`${o.name} · My preset`:o.name}</option>)}
        {selectedKey==='custom'&&<option value="custom">Custom</option>}
      </select>
      <input type="hidden" name="experience_name" value={experienceName}/>
      <p className="muted">Pick the closest classroom setup first. Changing a rule below turns it into a custom experience without changing the audience or deadline.</p>
    </section>

    {selectedKey==='custom'&&<section className="notice"><div className="row between"><div><b>Custom experience</b><p className="muted">Use these settings once, or save them as your own reusable testing experience.</p></div></div><label className="check"><input type="checkbox" checked={savePreset} onChange={e=>setSavePreset(e.target.checked)}/><span><b>Save this experience for later</b></span></label>{savePreset&&<><label>Preset name</label><input name="save_preset_name" value={presetName} onChange={e=>setPresetName(e.target.value)} maxLength={80} placeholder="My weekly remediation setup" required/></>}</section>}

    <section className="notice"><h3>Test environment</h3><select name="delivery_mode" value={settings.deliveryMode} onChange={e=>change('deliveryMode',e.target.value as Settings['deliveryMode'])}><option value="standard">Standard test</option><option value="restricted">Restricted Test Mode + integrity monitoring</option></select></section>

    <section className="notice"><h3>Full attempts</h3><div className="settings-grid"><div><label>Full test attempts</label><input name="max_attempts" type="number" min="1" max="100" value={settings.maxAttempts} disabled={settings.unlimited||settings.paidAccess} onChange={e=>change('maxAttempts',Number(e.target.value)||1)}/><p className="muted">2 means the original attempt plus 1 additional full attempt.</p></div></div><label className="check"><input type="checkbox" name="unlimited_attempts_until_due" checked={settings.unlimited} disabled={settings.paidAccess} onChange={e=>change('unlimited',e.target.checked)}/><span><b>Unlimited full attempts until due date</b></span></label><p className="muted">When another full attempt is allowed, CramLoop automatically builds a fresh retest from the approved test pool where possible.</p></section>

    <section className="notice"><h3>After a failed full attempt</h3><label className="check"><input type="checkbox" name="require_focused_retake_before_full" checked={settings.requireFocused} onChange={e=>change('requireFocused',e.target.checked)}/><span><b>Require a focused retest before another full attempt</b></span></label><div className="settings-grid"><div><label>Focused retest size</label><select name="focused_retake_percent" value={settings.focusedPercent} onChange={e=>change('focusedPercent',Number(e.target.value))}>{[10,20,30,40,50,60,70,80,90,100].map(n=><option key={n} value={n}>{n}% of full test</option>)}</select><p className="muted">For this test, {settings.focusedPercent}% is about {focusedCount} focused question{focusedCount===1?'':'s'}.</p></div><div><label>Grade required to proceed</label><select name="focused_retake_min_score" value={settings.focusedMinScore} onChange={e=>change('focusedMinScore',Number(e.target.value))}>{Array.from({length:101},(_,n)=><option key={n} value={n}>{n}%{n===0?' · completion only':''}</option>)}</select><p className="muted">0% means completion alone unlocks the next full attempt.</p></div></div><label className="check"><input type="checkbox" name="focused_retake_hints" checked={settings.focusedHints} onChange={e=>change('focusedHints',e.target.checked)}/><span><b>Show per-question teaching hints on focused retests</b> — never on the full test. <a href="/help#focused-hints">Learn more</a></span></label></section>

    <section className="notice"><h3>After-test learning <span className="muted">(optional)</span></h3><label className="check"><input type="checkbox" name="study_guide_enabled" checked={settings.studyGuide} onChange={e=>change('studyGuide',e.target.checked)}/><b>Study guide</b> — show subjects and concepts that need improvement</label><label className="check"><input type="checkbox" name="focused_retake_enabled" checked={settings.focusedRetake} onChange={e=>change('focusedRetake',e.target.checked)}/><b>Allow optional weak-area practice</b> — available even when a focused retest is not required</label></section>

    <details className="card"><summary><b>Advanced assignment settings</b></summary><label>Share-link expiration <span className="muted">(optional)</span></label><input name="link_expires_at" type="datetime-local"/><p className="muted">Usually the assignment due date is enough. Use this only when the link itself should stop opening at a different time.</p></details>

    <details className="card" open={settings.paidAccess}><summary><b>Paid practice access settings</b></summary><label className="check"><input type="checkbox" name="paid_access" checked={settings.paidAccess} onChange={e=>change('paidAccess',e.target.checked)}/><span><b>Charge students for this practice access</b> — Pro only</span></label><div className="settings-grid"><div><label>Access length</label><input name="access_duration_days" type="number" min="1" max="365" value={settings.accessDuration} onChange={e=>change('accessDuration',Number(e.target.value)||14)}/></div><div><label>Price</label><input name="price_dollars" type="number" min="1" step="0.01" value={settings.price} onChange={e=>change('price',e.target.value)} placeholder="12.99"/></div></div><p className="muted">{proActive?'Your account can create paid access. Checkout is not connected yet.':'Teacher Pro is required only when charging students.'}</p></details>
  </>
}
