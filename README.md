### Meeting Matrix — Angular Client + Node/SQLite Server

Dieses Projekt enthält:
- Einen Node.js/Express Server mit SQLite-Datenbank und Socket.IO für Echtzeit-Updates.
- Eine Angular Client-App, um Meetings zu erstellen und für jede Kombination aus Task (vertikal) und Section (horizontal) Mehrfach-Auswahlen (Checkboxen) vorzunehmen. Änderungen werden live in anderen Tabs/Browsern angezeigt.

#### 1) Voraussetzungen
- Node.js 18+ (empfohlen 20+)
- npm

#### 2) Installation

Server installieren:
```
cd server
npm install
```

Client installieren:
```
cd ../client
npm install
```

#### 3) Server starten
```
cd server
npm run dev
```
Server läuft danach auf `http://localhost:3000`.

#### 4) Client starten
In einem zweiten Terminal:
```
cd client
npm start
```
Client ist erreichbar unter `http://localhost:4200`.

Hinweis: Der Client ist standardmäßig auf den Server unter `http://localhost:3000` konfiguriert (siehe `client/src/app/env.ts`).

#### 5) Nutzung
1. Startseite: Neues Meeting anlegen (Name eingeben → „Erstellen“).
2. Nach dem Anlegen weitergeleitet zum Meeting-Board:
   - Oben rechts den eigenen Namen eintragen (wird im LocalStorage gespeichert).
   - Links (vertikal) Tasks hinzufügen.
   - Oben (horizontal) Sections hinzufügen.
   - In der Matrix per Checkboxen die eigene Teilnahme/Zuordnung pro Task+Section aktivieren/deaktivieren.
3. Öffnen Sie die gleiche Meeting-Seite in einem zweiten Browser-Tab/Fenster. Änderungen (neue Tasks/Sections und Checkbox-Klicks) werden live synchronisiert.

#### 6) API-Überblick (Server)
- `GET /health` — Healthcheck
- `GET /api/meetings` — Liste aller Meetings
- `POST /api/meetings` — Neues Meeting `{ name }`
- `GET /api/meetings/:id/full` — Komplettdaten für ein Meeting `{ meeting, tasks, sections, assignments }`
- `POST /api/meetings/:id/tasks` — Neue Task `{ name }`
- `POST /api/meetings/:id/sections` — Neue Section `{ name }`
- `POST /api/meetings/:id/assign` — Auswahl toggeln `{ taskId, sectionId, user, selected }`

Echtzeit: Socket.IO-Events `meeting:update` pro Meeting-Raum (`join` via Meeting-ID). Nach jeder Änderung wird ein Event gesendet:
- `{ type: 'task:add', task }`
- `{ type: 'section:add', section }`
- `{ type: 'assign:update', taskId, sectionId, user, selected }`

#### 7) Technische Details
- DB-Schema in `server/src/db.js` (`meetings`, `tasks`, `sections`, `assignments`).
- Server Einstieg: `server/src/index.js`.
- Client Einstieg: `client/src/main.ts`, Routing in `client/src/app/app.routes.ts`.
- Wichtige Client-Komponenten:
  - `MeetingListComponent` — Liste/Erstellen von Meetings
  - `MeetingBoardComponent` — Matrix-Board mit Tasks (vertikal), Sections (horizontal) und Checkboxen
- Services:
  - `ApiService` — REST-Calls
  - `SocketService` — Socket.IO Verbindung

#### 8) Hinweise/Erweiterungen
- Persistenz: SQLite-Datei liegt in `server/data/data.db` (wird beim ersten Start erzeugt).
- CORS ist serverseitig aktiviert, Entwicklung lokal problemlos.
- Keine Authentifizierung vorgesehen; der „user“-Name wird im Browser LocalStorage gespeichert.
- Erweiterbar um Sortierung der Tasks/Sections, Umbenennen/Löschen, Auth usw.
