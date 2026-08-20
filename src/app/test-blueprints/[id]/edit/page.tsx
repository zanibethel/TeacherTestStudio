import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import BlueprintEditor from '../../BlueprintEditor'
import {saveBlueprint} from '../../actions'

export default async function EditBlueprint({params}:{params:Promise<{id:string}>}){
 const{id}=await params
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const[{data:blueprint},{data:questionsRaw},{data:bundlePresetData}]=await Promise.all([
  supabase.from('teacher_test_blueprints').select('*').eq('id',id).eq('teacher_id',user.id).maybeSingle(),
  supabase.from('question_bank').select('chapter_number,chapter_title,subject_category,content_area,imported_collection_id').eq('teacher_id',user.id).limit(3000),
  supabase.rpc('get_teacher_builder_bundle_presets'),
 ])
 if(!blueprint)notFound()
 const collectionIds=[...new Set((questionsRaw??[]).map((q:any)=>q.imported_collection_id).filter(Boolean))]
 const{data:collections}=collectionIds.length?await supabase.from('shared_collections').select('id,title').in('id',collectionIds):{data:[] as any[]}
 const collectionTitle=new Map((collections??[]).map((c:any)=>[c.id,c.title]))
 const bundlePresets=Array.isArray(bundlePresetData)?bundlePresetData:[];const collectionBundle=new Map<string,{id:string;title:string}>()
 for(const preset of bundlePresets as any[]){for(const cid of preset.collection_ids??[]){if(!collectionBundle.has(cid))collectionBundle.set(cid,{id:preset.bundle_id,title:preset.bundle_title})}}
 const sourceMap=new Map<string,{key:string;title:string;collection_ids:Set<string>;questionCount:number}>()
 const questions=(questionsRaw??[]).map((q:any)=>{const bundle=q.imported_collection_id?collectionBundle.get(q.imported_collection_id):undefined;const key=!q.imported_collection_id?'custom':bundle?`bundle:${bundle.id}`:`collection:${q.imported_collection_id}`;const title=!q.imported_collection_id?'My custom questions':bundle?.title||collectionTitle.get(q.imported_collection_id)||'Imported resource';const current=sourceMap.get(key)??{key,title,collection_ids:new Set<string>(),questionCount:0};current.questionCount++;if(q.imported_collection_id)current.collection_ids.add(q.imported_collection_id);sourceMap.set(key,current);return{...q,source_bucket_key:key}})
 const sourceBuckets=[...sourceMap.values()].map(x=>({key:x.key,title:x.title,collection_ids:[...x.collection_ids],questionCount:x.questionCount})).sort((a,b)=>a.title.localeCompare(b.title))
 return <main><Link href="/test-blueprints">← Smart-test blueprints</Link><h1>Edit blueprint</h1><BlueprintEditor action={saveBlueprint} questions={questions as any} sourceBuckets={sourceBuckets} initial={blueprint as any}/></main>
}
