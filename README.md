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

#### 3) Server starten (Entwicklung)
```
cd server
npm run dev
```
Server läuft danach auf `http://localhost:3000`.

#### 4) Client starten (Entwicklung)
In einem zweiten Terminal:
```
cd client
npm start
```
Client ist erreichbar unter `http://localhost:4200`.

Hinweis: Der Client ist standardmäßig auf den Server unter `http://localhost:3000` konfiguriert (siehe `client/src/app/env.ts`).

#### 4b) Produktion: Build & Start (Server hostet den Angular‑Build)
So bauen und starten Sie eine Produktionsversion, bei der der Node‑Server die Angular‑App auf demselben Port ausliefert:

1. Abhängigkeiten installieren (einmalig):
```
cd server && npm install
cd ../client && npm install
```

2. Client im Production‑Modus bauen:
```
cd client
# Standard (entspricht Prod‑Build)
npm run build
# Optional explizit: npm run build -- --configuration production
```
Der Build landet unter `client/dist/app` (siehe `client/angular.json`).

3. Server im Production‑Modus starten:
```
cd ../server
npm start
```
Der Express‑Server liefert nun:
- die API unter `http://localhost:3000/api/...`
- die Angular‑App und statische Assets direkt von `http://localhost:3000/`

Optional:
- Port ändern: `PORT=8080 npm start`
- Umgebung setzen: `NODE_ENV=production` ist im Start‑Script bereits gesetzt (siehe `server/package.json`).

Technische Umsetzung: In `server/src/server.js` wird `express.static` auf `client/dist/app` gesetzt und ein SPA‑Fallback (`*`) liefert `index.html` für nicht‑API‑Routen, damit das Angular‑Routing (Deep Links wie `/meeting/123`) direkt funktioniert.

Re‑Deploy/Update:
- Nach Client‑Änderungen einfach Schritt 2 (Build) wiederholen und den Server neu starten.

#### 5) Nutzung
1. Startseite: Neues Meeting anlegen (Name eingeben → „Erstellen“).
2. Nach dem Anlegen weitergeleitet zum Meeting-Board:
   - Oben rechts den eigenen Namen eintragen (wird im LocalStorage gespeichert). Der Benutzer ist global (ohne Meeting‑FK) und wird explizit dem Meeting zugeordnet; die Zuordnungen verwenden eine User‑Fremdschlüssel‑ID (`user_id`).
   - Links (vertikal) Tasks hinzufügen.
   - Oben (horizontal) Sections hinzufügen.
   - In der Matrix per Checkboxen die eigene Teilnahme/Zuordnung pro Task+Section aktivieren/deaktivieren.
3. Öffnen Sie die gleiche Meeting-Seite in einem zweiten Browser-Tab/Fenster. Änderungen (neue Tasks/Sections und Checkbox-Klicks) werden live synchronisiert.

#### 6) API-Überblick (Server)
- `GET /health` — Healthcheck
- `GET /api/meetings` — Liste aller Meetings
- `POST /api/meetings` — Neues Meeting `{ name }`
- `DELETE /api/meetings/:id` — Meeting löschen (kaskadiert Tasks/Sections/Assignments)
- `GET /api/meetings/:id/full` — Komplettdaten für ein Meeting `{ meeting, tasks, sections, users, assignments }`
- `GET /api/meetings/:id/users` — Liste der Benutzer für das Meeting
- `POST /api/meetings/:id/users` — Benutzer anlegen (oder vorhandenen liefern) `{ name }`
- `DELETE /api/meetings/:id/users/:userId` — Benutzer aus Meeting entfernen (inkl. automatischem Löschen seiner Zuordnungen in diesem Meeting)
- `POST /api/meetings/:id/tasks` — Neue Task `{ name }`
- `POST /api/meetings/:id/sections` — Neue Section `{ name }`
- `POST /api/meetings/:id/assign` — Auswahl toggeln `{ taskId, sectionId, userId, selected }`

Echtzeit: Socket.IO-Events `meeting:update` pro Meeting-Raum (`join` via Meeting-ID). Nach jeder Änderung wird ein Event gesendet:
- `{ type: 'task:add', task }`
- `{ type: 'section:add', section }`
- `{ type: 'user:add', user }`
- `{ type: 'user:delete', userId }`
- `{ type: 'assign:update', taskId, sectionId, userId, selected }`

#### 7) Technische Details
- DB-Schema in `server/src/db.js` (`meetings`, `tasks`, `sections`, `users`, `assignments`).
- Server Einstieg: `server/src/server.js`.
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
- Keine Authentifizierung vorgesehen; Nutzer werden pro Meeting ohne Login angelegt; der Anzeigename kommt aus dem Browser LocalStorage.
- Erweiterbar um Sortierung der Tasks/Sections, Umbenennen/Löschen, Auth usw.

#### 9) build docker manually
docker build --platform linux/amd64,linux/arm64/v8 --no-cache -t nschle85/node-sqlite:latest --push .
