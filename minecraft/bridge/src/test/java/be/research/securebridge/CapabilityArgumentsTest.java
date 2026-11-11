package be.research.securebridge;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;
class CapabilityArgumentsTest {
 @Test void validMessage(){assertDoesNotThrow(()->CapabilityArguments.message(Map.of("playerName","GoldennBullet","message","Hello")));}
 @Test void invalidMessage(){assertThrows(IllegalArgumentException.class,()->CapabilityArguments.message(Map.of("playerName","GoldennBullet","message","bad\nmessage")));}
 @Test void validSpawn(){assertDoesNotThrow(()->CapabilityArguments.spawn(Map.of("type","ZOMBIE","x",0,"y",64,"z",0)));}
 @Test void rejectsBoss(){assertThrows(IllegalArgumentException.class,()->CapabilityArguments.spawn(Map.of("type","WITHER","x",0,"y",64,"z",0)));}
 @Test void rejectsNbt(){assertThrows(IllegalArgumentException.class,()->CapabilityArguments.spawn(Map.of("type","ZOMBIE","x",0,"y",64,"z",0,"nbt","{}")));}
 @Test void rejectsNonfinite(){assertThrows(IllegalArgumentException.class,()->CapabilityArguments.spawn(Map.of("type","ZOMBIE","x",Double.NaN,"y",64,"z",0)));}
 @Test void blockIntegerCoordinates(){assertDoesNotThrow(()->CapabilityArguments.location(Map.of("x",0,"y",64,"z",0,"type","STONE"),"type",true));}
 @Test void blockRejectsFraction(){assertThrows(IllegalArgumentException.class,()->CapabilityArguments.location(Map.of("x",0.5,"y",64,"z",0),null,true));}
 @Test void blockRejectsNbt(){assertThrows(IllegalArgumentException.class,()->CapabilityArguments.location(Map.of("x",0,"y",64,"z",0,"nbt","{}"),null,true));}
 @Test void materialAllowlist(){assertDoesNotThrow(()->CapabilityArguments.value("materials","DIAMOND_ORE"));assertThrows(IllegalArgumentException.class,()->CapabilityArguments.value("materials","COMMAND_BLOCK"));}
 @Test void weatherTimeSoundAllowlists(){assertDoesNotThrow(()->CapabilityArguments.preset(Map.of("weather","THUNDER"),"weather","weather"));assertDoesNotThrow(()->CapabilityArguments.preset(Map.of("time","NIGHT"),"time","times"));assertDoesNotThrow(()->CapabilityArguments.value("sounds","BLOCK_NOTE_BLOCK_PLING"));assertThrows(IllegalArgumentException.class,()->CapabilityArguments.value("sounds","EXPLODE"));}
 @Test void playerStateRejectsMetadataAndBadNames(){assertDoesNotThrow(()->CapabilityArguments.player(Map.of("playerName","GoldennBullet")));assertThrows(IllegalArgumentException.class,()->CapabilityArguments.player(Map.of("playerName","../x")));assertThrows(IllegalArgumentException.class,()->CapabilityArguments.player(Map.of("playerName","GoldennBullet","ip",true)));}
}
