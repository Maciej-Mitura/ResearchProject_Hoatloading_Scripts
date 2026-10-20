// Harmless FFI permission probe — does not load a real native library.
Deno.dlopen("nonexistent_research_probe.so", {});
