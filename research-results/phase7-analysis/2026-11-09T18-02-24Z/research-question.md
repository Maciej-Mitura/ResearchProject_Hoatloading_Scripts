# Onderzoeksvraag en begripsafbakening

In welke mate kan een defense-in-depth architectuur met Deno-permissies, gVisor-isolatie, Jev-gebaseerde risicoanalyse en OpenTelemetry-observability risico's detecteren, isoleren en beperken bij het uitvoeren van dynamisch geladen, onbetrouwbare TypeScript-scripts die via een beperkte API interageren met een actieve hostapplicatie?

Bron: de expliciete Phase 7-opdracht van de gebruiker. In de repository zijn geen duidelijk vastgelegde actuele officiële deelvragen gevonden; zie research-question-search.json en subquestion-analysis.md.

**Detecteren:** securityrelevant gedrag waarnemen en de beschikbare observaties interpreteren. **Isoleren:** uitvoerings- en bevoegdheidsgrenzen tussen script en omgeving. **Beperken:** toegestane effecten en resourcegebruik begrenzen. Een ontzegde actie is niet automatisch waargenomen, een observatie is niet automatisch een aanval, en een risicoklasse is geen autorisatiebeslissing.
