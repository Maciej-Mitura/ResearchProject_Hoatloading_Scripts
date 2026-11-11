let bytes=0; for(let i=0;i<500;i++) bytes+=(await Deno.readTextFile("/fixtures/allowed.txt")).length; console.log("reads=500 bytes="+bytes);
