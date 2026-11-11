# Antwoord op de hoofdonderzoeksvraag

## Detecteren

De architectuur maakt vooraf bepaalde securityrelevante handelingen zichtbaar
wanneer de runtime daarvoor betrouwbare observaties levert. In de gecontroleerde
tests bleven onder meer beperkte bestands- en omgevingsaanvragen zichtbaar, ook
wanneer een script een fout opving en daarna succesvol eindigde. PostgreSQL bewaart
de projectgegevens en correlatie; OpenTelemetry voegt een trace-/spanweergave en
collector-export toe. Geen van beide is op zichzelf een detectie-engine.

Die zichtbaarheid is onvolledig. Time-outs, uitvoertruncatie en auditlimieten
verminderen de beschikbare gegevens. HOL-008 toont bovendien een opgevangen
subprocespoging zonder overeenkomstige vertrouwde permission-observatie. Beide
classifiers geven daarvoor LOW tegenover het onderzoekerslabel REVIEW. Een complete
collectie betekent daarom niet dat alle handelingen zijn waargenomen.

De deterministische baseline stemt op 24 van 25 gecontroleerde gevallen overeen
met de onderzoekerslabels; Jev's modale klasse op 16 van 25. Jev was op 23 gevallen
unaniem over vijf herhalingen, maar bood geen modaal geval waarin alleen Jev het
referentielabel herstelde. Binnen deze gegevensrepresentatie is dus geen aanvullende
modale overeenstemmingswinst aangetoond. Dit zijn geen percentages voor detectie
van willekeurige kwaadaardige scripts. Alle 25 classifierrecords zijn als JavaScript
geregistreerd; een afzonderlijke beperkte TypeScript-workload bevestigt uitvoering,
niet een zelfstandige brede TypeScript-classificatiestudie. [S07–S09,S15,S18,S22]

## Isoleren

Deno beperkte de runtimebevoegdheden binnen de geteste profielen. Docker voegde
een afzonderlijke container-, proces- en bestandssysteemcontext en ingestelde
resourcegrenzen toe. De aanwezigheid van onder meer non-root, read-only root,
geheugen-/PID-limieten en privilege-instellingen is volgens de leidende Phase 5-
matrix configuratiegeverifieerd; specifieke historische gedragsproeven worden
afzonderlijk vermeld. Dit is geen algemene toets van exploitbestendigheid.

gVisor voegt door zijn ontwerp een extra application-kernelgrens toe. De proef
toont echte runsc-uitvoering en compatibiliteit voor 9 van 10 workloads, met
meetbare operationele kosten. Zij toont geen escape-preventie of verhoogde
weerstand tegen kernel-exploits. De host-chatworkload faalde onder runsc door
naamresolutie; de volledige normale hostketen is onder runc bevestigd. Alle in
de onderzoeksvraag genoemde lagen zijn dus niet als één transparant geheel voor
ieder scenario gevalideerd. [S04,S13–S18,S31,S32]

## Beperken

Het sterkste empirische resultaat ligt in het begrenzen van concrete bevoegdheden,
hosteffecten en geselecteerd resourcegedrag. De Host Gateway scheidt netwerktoegang
van applicatieautorisatie: alleen een geldige uitvoeringsgebonden sessie kan de
smalle chat.broadcast-capability aanvragen. Admin- en directe omwegen en vervalste
correlatie werden afgewezen; een geautoriseerde aanvraag werd door Paper bevestigd.
De runner beperkte gelijktijdige uitvoering tot twee jobs, wees overloop af en
herstelde capaciteit. Time-out, begrensde uitvoer en cleanup beperkten de geteste
resourcegevallen. Dit is lokale beheersing, geen algemene DoS-bescherming.

Risicoanalyse verleent of ontneemt daarbij geen bevoegdheden. Bij een geteste
collectoruitval bleven beperkingen en hostautorisatie werken; een geïnjecteerde
analysefout kon naast succesvolle uitvoering bestaan. Die scheiding beperkt de
afhankelijkheid van advies en observability, maar bewijst geen herstelgarantie
voor een uitgevallen API of database. [S03,S06,S19–S23]

## Overkoepelend antwoord

De resultaten ondersteunen defense-in-depth voor gecontroleerde, beperkte
scriptuitvoering: verschillende lagen bewaken verschillende grenzen en koppelen
bruikbare observaties aan de uitvoering. De onderbouwing is het sterkst voor
gescopeerde bevoegdheden, de capabilitygrens en geselecteerde lifecyclecontroles.
Zij is beperkter voor volledige gedragsdetectie, de aanvullende classificatiewaarde
van Jev en de security-effectiviteit van kernelisolatie. Zonder volledige
laagverwijderingsproeven of representatieve aanvalspopulatie kan geen percentage
risicoreductie tegenover één enkele laag worden vastgesteld. Het oordeel geldt
voor de geteste PoC en expliciete grenzen, niet voor veilige willekeurige
TypeScript-uitvoering in productie. [S01–S32]
