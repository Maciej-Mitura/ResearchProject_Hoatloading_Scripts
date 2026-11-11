# Presentatie-assets

## Echte browseropnamen

De opnamen zijn gemaakt in Edge tegen de lokale Runlattice-stack. De actuele sessie gebruikte bestaande records, op één aangegeven opname na die is hergebruikt uit de vorige smoke. Tablet- en mobiele weergaven zijn viewportemulatie. Er is geen Minecraft-clientopname. Host Activity en het afgeronde capability-record tonen opgeslagen Paper-bevestiging, geen visuele waarneming in de spelclient.

| Bestand | Wat toont het en bij welk hoofdstuk | Presentatiegebruik |
|---|---|---|
| [after-workbench-light.png](screenshots/after-workbench-light.png) | Workbench-overzicht in licht thema | geschikt, bestaande records zijn voorbeelddata |
| [after-workbench-dark.png](screenshots/after-workbench-dark.png) | Workbench-overzicht in donker thema | geschikt, bestaande records zijn voorbeelddata |
| [after-editor.png](screenshots/after-editor.png) | CodeMirror met actief hulpbestand | geschikt, bestaande records zijn voorbeelddata |
| [after-assistant.png](screenshots/after-assistant.png) | Opgeslagen Gemini-voorstel met inline keuzes | geschikt, bestaande records zijn voorbeelddata |
| [after-profile-tooltip.png](screenshots/after-profile-tooltip.png) | Profielkeuze met informatie over grants | geschikt, bestaande records zijn voorbeelddata |
| [after-permission-review.png](screenshots/after-permission-review.png) | Capability review vóór bevestiging | geschikt, bestaande records zijn voorbeelddata |
| [after-progress.png](screenshots/after-progress.png) | Actieve status tijdens vorige echte console-smoke | geschikt met vermelding van historische smoke |
| [after-completed.png](screenshots/after-completed.png) | Afgerond record met authority en Paper-bevestiging | geschikt, bestaande records zijn voorbeelddata |
| [after-failed.png](screenshots/after-failed.png) | Opgeslagen mislukte uitvoering | geschikt, bestaande records zijn voorbeelddata |
| [after-timeout.png](screenshots/after-timeout.png) | Opgeslagen oneindige lus met timeoutdiagnose | geschikt, bestaande records zijn voorbeelddata |
| [after-insights.png](screenshots/after-insights.png) | Periodefilters en Execution history | geschikt, bestaande records zijn voorbeelddata |
| [after-insights-light.png](screenshots/after-insights-light.png) | Insights in licht thema | geschikt, bestaande records zijn voorbeelddata |
| [after-insights-tablet.png](screenshots/after-insights-tablet.png) | Insights bij 768 px viewport | geschikt, bestaande records zijn voorbeelddata |
| [after-host.png](screenshots/after-host.png) | Host Activity met opgeslagen Paper-records | geschikt, bestaande records zijn voorbeelddata |
| [after-host-light.png](screenshots/after-host-light.png) | Host Activity in licht thema | geschikt, bestaande records zijn voorbeelddata |
| [after-limits.png](screenshots/after-limits.png) | What are the limits? op desktop | geschikt, bestaande records zijn voorbeelddata |
| [after-limits-mobile.png](screenshots/after-limits-mobile.png) | Limits op 390 px | geschikt, bestaande records zijn voorbeelddata |
| [after-limits-tablet.png](screenshots/after-limits-tablet.png) | Limits op 768 px | geschikt, bestaande records zijn voorbeelddata |
| [after-settings.png](screenshots/after-settings.png) | Settings in donker thema | geschikt, bestaande records zijn voorbeelddata |
| [after-settings-light.png](screenshots/after-settings-light.png) | Settings in licht thema | geschikt, bestaande records zijn voorbeelddata |
| [after-help.png](screenshots/after-help.png) | How to use-dialoog | geschikt, bestaande records zijn voorbeelddata |
| [after-workbench-mobile.png](screenshots/after-workbench-mobile.png) | Workbench bij 390 px, gestapelde navigatie | geschikt, bestaande records zijn voorbeelddata |

## Deterministische diagrammen

De bestandsstam verwijst naar het technische onderwerp. In `diagrams/` staan 15 Mermaid-bronnen en 15 SVG's. De hoofdtekst bevat alle Mermaid-definities inline. De SVG's zijn lokaal en deterministisch uit diezelfde bronnen getekend met `inspection/render-fallback.py`. Hun lay-out kan verschillen van een Mermaid-renderer. De oorspronkelijke Mermaid-installatie is afgebroken nadat het ophalen van de renderafhankelijkheden bleef hangen.

| Bestandsstam | Onderwerp | Presentatiegebruik |
|---|---|---|
| 01-architectuur | Architectuur | technische toelichting of appendix |
| 02-uitvoeringsflow | Uitvoeringsflow | technische toelichting of appendix |
| 03-trust | Vertrouwensgrenzen | technische toelichting of appendix |
| 04-goedkeuring | Capability-goedkeuring | technische toelichting of appendix |
| 05-gateway-paper | Gateway naar Paper | technische toelichting of appendix |
| 06-evidence | Bewijs en advies | technische toelichting of appendix |
| 07-versies | Multi-file opslaan en uitvoeren | technische toelichting of appendix |
| 08-lagen | Deno Docker en gVisor | technische toelichting of appendix |
| 09-data | Vereenvoudigd PostgreSQL-model | technische toelichting of appendix |
| 10-navigatie | UI-navigatie | technische toelichting of appendix |
| 11-presentatie-architectuur | Architectuur voor presentatie | geschikt als hoofdslide |
| 12-presentatie-uitvoering | Uitvoering voor presentatie | geschikt als hoofdslide |
| 13-presentatie-goedkeuring | Goedkeuring voor presentatie | geschikt als hoofdslide |
| 14-compose | Compose-netwerken | technische toelichting of appendix |
| 15-timeout | Timeout en audit | technische toelichting of appendix |
