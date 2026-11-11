# Project en hoofdonderzoeksvraag

Runlattice is een lokale werkbank waarmee een gebruiker JavaScript of TypeScript kan schrijven, opslaan en eenmalig uitvoeren. Een vertrouwde runner start daarvoor een tijdelijke Deno-container. Standaard kan een script rekenen en tekst afdrukken. Een script met Minecraft-functionaliteit gebruikt de Host SDK. Een aparte Host Gateway controleert de bevoegdheid voordat SecureBridge een beperkte Paper-operatie uitvoert. De werkbank toont het uitvoeringsresultaat, verzamelde observaties en een afzonderlijke risicobeoordeling. Gemini kan scripts en capability-aanvragen voorstellen. De gebruiker beoordeelt die aanvragen per opgeslagen versie.

**In één zin.** Runlattice voert onbetrouwbare scripts uit in een tijdelijke sandbox en koppelt toegestane Minecraft-acties aan controleerbare records.

> In welke mate kan een defense-in-depth architectuur met Deno-permissies, gVisor-isolatie, Jev-gebaseerde risicoanalyse en OpenTelemetry-observability risico's detecteren, isoleren en beperken bij het uitvoeren van dynamisch geladen, onbetrouwbare TypeScript-scripts die via een beperkte API interageren met een actieve hostapplicatie?

Letterlijk uit `research-results/phase7-analysis/2026-11-09T18-02-24Z/research-question.md`. Daar is de Phase 7-opdracht als bron genoemd. Actuele officiële deelvragen zijn daar niet bevestigd. Detecteren betekent observeerbaar gedrag registreren en interpreteren. Isoleren betekent grenzen trekken tussen job, Docker-host en Minecraft. Beperken betekent bevoegdheden, looptijd en resources begrenzen. Defense-in-depth betekent dat die maatregelen verschillende verantwoordelijkheden dragen.

## Identiteit van de inspectie

Repository `C:/Users/mimac.DESKTOP-OQT5HDD/Desktop/RP_Hotload_Script/ResearchProject_Hoatloading_Scripts`. Branch `master`, HEAD `23f7e66a6f6e2ed171d9d6fe36fe32e87e12c09f`. Start 11 november 2026 om 15:17:36 UTC. Dirty tree met 96 gewijzigde en 2 verwijderde tracked bestanden, plus 1.826 untracked bestanden vóór het dossier. Die delta bevat zowel onderzoeksmateriaal als latere wijzigingen. De post-research lagen zijn herkenbaar in manifests, multi-file, het uitgebreide SDK/registry, de herstelde Assistant en het Runlattice-frontend. De telling omvat meer dan deze lagen en kent geen exacte fase toe aan elk gewijzigd bestand.

Docker Desktop-context `desktop-linux`, Engine 28.1.1, Compose v2.35.1-desktop.1. Web op 15173, API op 13000, Paper op 25565. Publieke config meldde `docker`, `deterministic`, `gemini`, `gemini-3.8-flash` en `configured`. Web en SecureBridge hebben versie 0.1.0 in hun projectmetadata. Runlattice is de zichtbare merknaam. Bewijsniveaus in dit dossier zijn broncode, read-only runtime-waarneming en gedateerd historisch experiment.
