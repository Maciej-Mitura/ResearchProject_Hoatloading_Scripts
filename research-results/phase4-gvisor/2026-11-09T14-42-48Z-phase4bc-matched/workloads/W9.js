let state=0x12345678; for(let i=0;i<30000000;i++) state=(Math.imul(state,1664525)+1013904223)>>>0; console.log(state);
