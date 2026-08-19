'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function isoOrNull(value:FormDataEntryValue|null){
  const raw=String(value??'').trim()
  return raw?new Date(raw).toISOString():null
}

export async function savePricingRule(fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const amountRaw=Number(fd.get('adjustment_value')||0)
  const type=String(fd.get('adjustment_type')||'percent_off')
  const adjustmentValue=type==='percent_off'?Math.round(amountRaw):Math.round(amountRaw*100)
  const args={
    p_rule_id:null,
    p_name:String(fd.get('name')??'').trim(),
    p_label:String(fd.get('label')??'').trim(),
    p_audience_type:String(fd.get('audience_type')??'everyone'),
    p_group_id:String(fd.get('group_id')??'')||null,
    p_product_scope:String(fd.get('product_scope')??'platform'),
    p_category:String(fd.get('category')??''),
    p_bundle_id:String(fd.get('bundle_id')??'')||null,
    p_access_option_id:String(fd.get('access_option_id')??'')||null,
    p_adjustment_type:type,
    p_adjustment_value:adjustmentValue,
    p_starts_at:isoOrNull(fd.get('starts_at')),
    p_ends_at:isoOrNull(fd.get('ends_at')),
    p_priority:Number(fd.get('priority')||0),
    p_active:fd.get('active')==='on'
  }
  const{error}=await supabase.rpc('admin_upsert_pricing_rule',args)
  if(error)redirect('/admin/pricing?error='+encodeURIComponent(error.message))
  redirect('/admin/pricing?message='+encodeURIComponent('Promotion saved.'))
}

export async function setPricingRuleActive(ruleId:string,active:boolean){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{error}=await supabase.rpc('admin_set_pricing_rule_active',{p_rule_id:ruleId,p_active:active})
  if(error)redirect('/admin/pricing?error='+encodeURIComponent(error.message))
  redirect('/admin/pricing?message='+encodeURIComponent(active?'Promotion activated.':'Promotion paused.'))
}

export async function deletePricingRule(ruleId:string){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{error}=await supabase.rpc('admin_delete_pricing_rule',{p_rule_id:ruleId})
  if(error)redirect('/admin/pricing?error='+encodeURIComponent(error.message))
  redirect('/admin/pricing?message='+encodeURIComponent('Promotion deleted.'))
}
