# Concept academische conclusie

Dit onderzoek laat zien dat een defense-in-deptharchitectuur de bevoegdheden en
geselecteerde effecten van dynamisch uitgevoerde, onbetrouwbare scripts binnen een
gecontroleerde PoC kan begrenzen en daarbij bruikbare, maar onvolledige observaties
kan vastleggen. De sterkste bijdrage ligt in de combinatie van gescopeerde Deno-
permissies, Docker-uitvoeringsgrenzen, lokale lifecyclecontroles en een afzonderlijke
Host Gateway. Netwerktoegang verleende niet automatisch applicatiebevoegdheid;
geautoriseerde chatbroadcasts bereikten een door Paper bevestigde hostwerking,
terwijl geteste admin-, directe en correlatieomwegen werden afgewezen.

De detectiecomponent kent duidelijke grenzen. De deterministische baseline kwam
op 24 van 25 gecontroleerde gevallen overeen met de onderzoekerslabels. Jev bereikte
modaal 16 van 25, was op 23 gevallen unaniem en herstelde geen enkel modaal geval dat
de baseline miste. Beide misten HOL-008, waarin een vertrouwde observatie ontbrak.
Deze uitkomst ondersteunt geen algemene uitspraak over AI-risicoanalyse: zij geldt
voor één model, beleid, representatie en kleine, als JavaScript geregistreerde
casusverzameling. De TypeScript-uitvoering is slechts afzonderlijk en beperkt
gedemonstreerd.

gVisor werkte voor 9 van 10 workloads, maar introduceerde in de WSL2-opstelling
workloadspecifieke supervisor-duurratio's van ongeveer 1,62 tot 2,61 voor vergelijkbare
niet-time-outtaken. De host-chatworkload faalde door DNS-compatibiliteit. De proef
onderbouwt runtime-integratie en operationele afwegingen, geen escape-preventie.
OpenTelemetry maakte gecorreleerde uitvoering zichtbaar in spans en events, terwijl
PostgreSQL de duurzame projectregistratie bleef. De debugexporter en ontbrekende
volledige Paper-span beperken de observabilitybijdrage; de geteste collectoruitval
verzwakte de bestaande beperkingen niet.

De onderzoeksvraag wordt daarmee ondersteund met belangrijke beperkingen:
gescopeerde bevoegdheden en effecten zijn overtuigender onderbouwd dan uitputtende
detectie of extra kernelbeveiliging. De kleine gerelateerde casusset, één host en
runtimeconfiguratie, deels alleen geïnspecteerde controles en ontbrekende exploit-
en crashproeven begrenzen de generaliseerbaarheid. Vervolgonderzoek kan zich richten
op rijkere vertrouwde observaties, onafhankelijkere casussen en de geconstateerde
netwerk-/tracebeperkingen. Dat vervolg is niet uitgevoerd en vormt geen voorwaarde
om de huidige negatieve en positieve bevindingen te rapporteren.
