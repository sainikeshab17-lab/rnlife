"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Layers, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";

type Collection = { slug:string; total_products:number; active_products:number; products:Array<{id:string;name:string;slug:string;is_active:boolean;image:string}> };
export default function AdminCollectionsPage() {
  const [collections,setCollections] = useState<Collection[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await fetch("/api/admin/collections",{cache:"no-store"}); const data = await res.json(); if(!res.ok) throw new Error(data.error || "Failed to load live collections."); setCollections(Array.isArray(data.collections)?data.collections:[]); }
    catch(e){setError(e instanceof Error?e.message:"Failed to load live collections.");} finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  return <AdminLayout title="Collections & Curated Drops" subtitle="Live product groupings derived from the Supabase products table. No demo collections are shown." actions={<button onClick={()=>void load()} disabled={loading} className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/>Refresh</button>}>
    {error && <div role="alert" className="mb-5 p-4 border border-red-200 bg-red-50 text-sm text-red-800">{error}<button onClick={()=>void load()} className="ml-3 underline font-bold">Retry</button></div>}
    {loading ? <div className="p-10 bg-white border text-sm text-neutral-500">Loading live products and collection groups…</div> : collections.length === 0 ? <div className="p-10 bg-white border text-center"><Layers className="w-8 h-8 mx-auto mb-3 text-neutral-400"/><h3 className="font-bold">No collection groups found</h3><p className="text-sm text-neutral-500 mt-1">Add a collection_slug to products in the catalog to group them here.</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{collections.map(col=><section key={col.slug} className="border border-neutral-200 bg-white shadow-sm overflow-hidden"><div className="relative h-44 bg-neutral-100">{col.products.find(p=>p.image)?.image ? <Image src={col.products.find(p=>p.image)!.image} alt={col.slug} fill unoptimized className="object-cover" sizes="(max-width:768px) 100vw,50vw"/> : <div className="h-full flex items-center justify-center"><Layers className="w-10 h-10 text-neutral-300"/></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/><div className="absolute bottom-4 left-4 text-white"><span className="text-[10px] uppercase font-mono tracking-widest text-lime-300 font-bold">LIVE PRODUCT GROUP</span><h3 className="text-xl font-black uppercase">{col.slug}</h3></div></div><div className="p-5"><div className="grid grid-cols-2 gap-3 mb-4"><div className="bg-neutral-50 border p-3"><p className="text-[10px] uppercase text-neutral-500 font-bold">Total products</p><p className="text-xl font-black">{col.total_products}</p></div><div className="bg-neutral-50 border p-3"><p className="text-[10px] uppercase text-neutral-500 font-bold">Active products</p><p className="text-xl font-black">{col.active_products}</p></div></div><div className="space-y-2">{col.products.slice(0,5).map(p=><div key={p.id} className="flex justify-between gap-3 text-xs"><span className="truncate">{p.name}</span><span className={p.is_active?"text-emerald-700":"text-neutral-400"}>{p.is_active?"Active":"Draft"}</span></div>)}</div><div className="pt-4 mt-4 border-t flex justify-between items-center text-xs"><span className="text-neutral-500">{col.total_products-col.products.slice(0,5).length>0?`Showing 5 of ${col.total_products}`:`${col.total_products} product(s)`}</span><Link href={`/collections/${col.slug}`} target="_blank" className="font-bold flex items-center gap-1 hover:underline">View live <ExternalLink className="w-3.5 h-3.5"/></Link></div></div></section>)}</div>}
  </AdminLayout>;
}
