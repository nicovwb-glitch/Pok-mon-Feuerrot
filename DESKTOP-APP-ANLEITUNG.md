# Windows-11-Desktop-App veröffentlichen

Der GitHub-Workflow erstellt automatisch eine installierbare Windows-EXE. Beim Build werden alle Pokémon-Daten, Entwicklungen, Feuerrot-Attacken sowie Pokémon- und Itembilder heruntergeladen und in den Installer eingebaut.

## Release erstellen

1. Repository auf GitHub öffnen.
2. `Actions` öffnen.
3. Links `Windows-App veröffentlichen` wählen.
4. `Run workflow` anklicken.
5. Versionsnummer eintragen und starten.
6. Nach Abschluss rechts im Repository `Releases` öffnen.
7. Die `.exe` unter `Assets` herunterladen.

Die Installation legt auf Wunsch automatisch eine Desktop- und Startmenü-Verknüpfung an. Spielstände werden lokal innerhalb der Desktop-App gespeichert und können weiterhin über Export/Import gesichert werden.
