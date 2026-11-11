import { assertEquals, assertRejects, assertThrows, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { configureChatProvider, createChatProvider, ChatProviderError } from "../src/providers/chat.ts";
import { GeminiChatProvider } from "../src/providers/gemini.ts";
import { configRoutes } from "../src/routes/config.ts";
for(const kind of [undefined,""," ","typo-provider"]){
 Deno.test("missing or unknown assistant is unavailable, never mock: "+String(kind),async()=>{
  const provider=configureChatProvider(kind);assertEquals(provider.name,"unavailable");
  await assertRejects(()=>provider.respond({conversationId:"test",userMessage:"hello",history:[]}),ChatProviderError);
  const response=await configRoutes(provider,"docker").request("http://test/public");const body=await response.json();assertEquals(body.chatStatus,"unavailable");assertEquals(body.executionProvider,"docker");assertEquals(typeof body.chatUnavailableReason,"string");
 });
}
Deno.test("factory rejects unknown rather than silently falling back",()=>{assertThrows(()=>createChatProvider("bad"),ChatProviderError);});
Deno.test("explicit mock remains clearly identified",async()=>{const response=await configRoutes(configureChatProvider("mock")).request("http://test/public");assertEquals((await response.json()).chatStatus,"mock");});
Deno.test("missing real credential becomes unavailable without taking execution offline",()=>{const previous=Deno.env.get("GEMINI_API_KEY");Deno.env.delete("GEMINI_API_KEY");try{assertEquals(configureChatProvider("gemini").name,"unavailable");}finally{if(previous!==undefined)Deno.env.set("GEMINI_API_KEY",previous);}});
Deno.test("real upstream failure propagates without generating mock text",async()=>{const provider=new GeminiChatProvider({apiKey:"test",model:"existing",generate:()=>Promise.reject(new ChatProviderError("rate_limit","Provider limited"))});await assertRejects(()=>provider.respond({conversationId:"test",userMessage:"hello",history:[]}),ChatProviderError,"Provider limited");});
Deno.test("Gemini wire request keeps key out of URL and passes current context",async()=>{
 const original=globalThis.fetch;const seen:Record<string,unknown>={};globalThis.fetch=async(input,init)=>{const request=init as {headers?:Record<string,string>;body?:string;signal?:unknown};seen.url=String(input);seen.key=request.headers?.["x-goog-api-key"];seen.body=JSON.parse(String(request.body));seen.signal=!!request.signal;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({message:"dynamic response",proposal:null})}]}}]});};
 try{const response=await new GeminiChatProvider({apiKey:"secret-test-value",model:"existing"}).respond({conversationId:"test",userMessage:"question",history:[],systemInstruction:"current truthful context"});assertEquals(response.content,"dynamic response");assertEquals(String(seen.url).includes("secret-test-value"),false);assertEquals(seen.key,"secret-test-value");assertEquals(seen.signal,true);assertStringIncludes(JSON.stringify(seen.body),"current truthful context");}finally{globalThis.fetch=original;}
});
