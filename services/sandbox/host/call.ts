export interface CapabilityResult<T = Record<string, unknown>> {
 accepted: boolean; success?: boolean; commandId?: string; callId?: string; data?: T;
 error?: {code:string;message:string};
}
export async function call<T>(capability:string,args:unknown):Promise<CapabilityResult<T>> {
 const base=Deno.env.get("HOST_GATEWAY_URL"), credential=Deno.env.get("HOST_CAPABILITY_TOKEN");
 if(!base || !credential) throw new Error("Host SDK unavailable for this execution profile");
 const parts=credential.split(":");
 const token=parts.length===2?parts[1]:credential;
 const headers:Record<string,string>={"Content-Type":"application/json",Authorization:`Bearer ${token}`};
 if(parts.length===2) headers["X-Execution-Id"]=parts[0];
 try {
  const res=await fetch(`${base.replace(/\/$/,"")}/v1/capabilities/${capability}`,{method:"POST",headers,body:JSON.stringify(args),signal:AbortSignal.timeout(6000)});
  const body=await res.json() as CapabilityResult<T>;
  return body;
 } catch { return {accepted:false,error:{code:"CAPABILITY_HOST_UNAVAILABLE",message:"Host capability service unavailable"}}; }
}
