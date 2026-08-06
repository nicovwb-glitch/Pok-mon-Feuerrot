# Feuerrot als Offline-App installieren

## Enthalten

- Installierbare Progressive Web App (PWA)
- Eigenes Feuerrot-Desktop-Symbol
- Start ohne sichtbaren Browserrahmen
- Automatische Aktualisierung nach neuen GitHub-Versionen
- Offline-Zwischenspeicherung der vollständigen App-Oberfläche
- Langfristiger Cache für bereits geladene PokéAPI-Daten, Pokémon-Bilder, Itembilder und Schriftarten
- Bestehende lokale Spielstände bleiben erhalten

## Wichtig

Die App-Oberfläche, Regeln, Teams, Encounter, Notizen und bereits geladene Inhalte funktionieren offline. Noch nie aufgerufene externe Pokémon-Details oder Bilder benötigen beim ersten Aufruf weiterhin Internet und werden danach gespeichert.

## Nach dem Einfügen

```bash
npm install
npm run build
git add .
git commit -m "PWA Offline App"
git push
```

Danach die veröffentlichte GitHub-Pages-Seite in Chrome oder Edge öffnen und über das Installationssymbol in der Adressleiste installieren.
