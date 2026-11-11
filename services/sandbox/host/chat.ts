import { call } from "./call.ts";
export interface BroadcastResult { accepted:boolean;success?:boolean;commandId?:string;callId?:string;capability?:string;error?:{code:string;message:string} }
/** Legacy profile: acceptance is queueing. Manifest profile also returns bounded Paper confirmation. */
export async function broadcast(message:string):Promise<BroadcastResult> {
 if(typeof message!=="string") throw new TypeError("host.chat.broadcast(message) requires a string");
 return await call("chat.broadcast",{message});
}
