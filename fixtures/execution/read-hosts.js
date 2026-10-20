const value = await Deno.readTextFile("/etc/hosts");
console.log(value);
