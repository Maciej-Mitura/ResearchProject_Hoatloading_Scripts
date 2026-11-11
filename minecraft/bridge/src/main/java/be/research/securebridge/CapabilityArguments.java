package be.research.securebridge;
import java.util.Map;
import java.util.Set;
import com.google.gson.JsonParser;
/** Defense in depth. Entity allowlist generated from the shared registry. */
final class CapabilityArguments {
 private static final Set<String> TYPES;
 private static final Map<String,Set<String>> VALUES=new java.util.HashMap<>();
 static {
  try(var stream=CapabilityArguments.class.getResourceAsStream("/capability-registry.json")) {
   if(stream==null) throw new IllegalStateException("Missing capability registry");
   var registry=JsonParser.parseString(new String(stream.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
   TYPES=new java.util.HashSet<>();
   registry.getAsJsonArray("entityTypes").forEach(t->TYPES.add(t.getAsString()));
   for(var key: new String[]{"materials","weather","times","sounds"}) {var values=new java.util.HashSet<String>();registry.getAsJsonArray(key).forEach(v->values.add(v.getAsString()));VALUES.put(key,values);}
  } catch(java.io.IOException e) { throw new ExceptionInInitializerError(e); }
 }
 static void value(String key,Object value) {if(!VALUES.get(key).contains(value)) throw new IllegalArgumentException();}
 static void player(Map<String,Object> a) {if(!a.keySet().equals(Set.of("playerName")) || !(a.get("playerName") instanceof String n) || !n.matches("[A-Za-z0-9_]{1,16}")) throw new IllegalArgumentException();}
 static void location(Map<String,Object> a,String extra,boolean integer) {
  var keys=new java.util.HashSet<>(Set.of("x","y","z"));if(extra!=null)keys.add(extra);
  if(!a.keySet().equals(keys)) throw new IllegalArgumentException();
  for(var axis:new String[]{"x","y","z"}) if(!(a.get(axis) instanceof Number n) || !Double.isFinite(n.doubleValue()) || Math.abs(n.doubleValue())>30000000 || (integer && n.doubleValue()!=Math.floor(n.doubleValue()))) throw new IllegalArgumentException();
 }
 static void preset(Map<String,Object> a,String key,String registry) {if(!a.keySet().equals(Set.of(key)))throw new IllegalArgumentException();value(registry,a.get(key));}
 static void message(Map<String,Object> a) {
  if(!a.keySet().equals(Set.of("playerName","message")) || !(a.get("playerName") instanceof String name) || !name.matches("[A-Za-z0-9_]{1,16}") || !(a.get("message") instanceof String msg) || msg.isBlank() || msg.length()>256 || msg.matches("(?s).*[\\x00-\\x1f\\x7f§].*")) throw new IllegalArgumentException();
 }
 static void spawn(Map<String,Object> a) {
  if(!a.keySet().equals(Set.of("type","x","y","z")) || !TYPES.contains(a.get("type"))) throw new IllegalArgumentException();
  for(var axis: new String[]{"x","y","z"}) if(!(a.get(axis) instanceof Number n) || !Double.isFinite(n.doubleValue()) || Math.abs(n.doubleValue())>30000000) throw new IllegalArgumentException();
 }
}
