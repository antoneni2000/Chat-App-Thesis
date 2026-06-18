# AVIEL Chat App

Aplicatie web de chat in timp real, cu autentificare clasica (email + parola) sau Google, conversatii 1-la-1 si de grup, atasamente (imagini/fisiere), indicatori de typing, status online/offline si confirmari de livrare/citire.

Stack: **Spring Boot 3 + PostgreSQL + WebSocket (STOMP)** pe backend, **React 18 + Vite** pe frontend, **Google Cloud Storage** pentru atasamente.

---

## Cerinte


| Tool | Versiune minima | Verificare |
|------|----------------|------------|
| Java JDK | 21 | `java -version` |
| Maven | 3.9+ (sau foloseste `mvnw`) | `mvn -v` |
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |

Optional: un cont Google Cloud (doar daca vrei sa testezi atasamente).

---

## Structura proiectului

```
Chat App/
├── backend/        Spring Boot API + WebSocket server
│   ├── src/        Cod sursa Java
│   └── pom.xml
├── frontend/       Aplicatie React (Vite)
│   ├── src/        Componente, pagini
│   └── package.json
└── README.md
```

---

## Setup pas cu pas

### 1. Cloneaza repo-ul

```bash
git clone <url-repo>
cd "Chat App"
```

### 2. Pregateste baza de date

Porneste PostgreSQL si creeaza o baza de date numita `chatapp`:

```sql
CREATE DATABASE chatapp;
```

Default-urile din `backend/src/main/resources/application.properties` sunt:
- URL: `jdbc:postgresql://localhost:5432/chatapp`
- user: `postgres`
- parola: `1234`

Daca ai alta configurare, suprascrie cu variabile de mediu (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`).

Tabelele se creeaza automat la prima pornire (Hibernate `ddl-auto=update`).

### 3. Configurare Google (optional)

Daca vrei login cu Google si upload de atasamente:
- Pune fisierul de credentiale GCS in `backend/gcs-credentials.json` (sau seteaza `GCS_CREDENTIALS_PATH`).
- Seteaza `GOOGLE_CLIENT_ID` cu Client ID-ul tau de OAuth.

Daca nu, login-ul cu email + parola si chat-ul text functioneaza fara aceste setari (upload-ul de fisiere va da eroare).

### 4. Porneste backend-ul

```bash
cd backend
./mvnw spring-boot:run
```

Pe Windows PowerShell:
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Backend-ul porneste pe `http://localhost:8081`.

### 5. Porneste frontend-ul

In alt terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend-ul porneste pe `http://localhost:5173` (sau urmatorul port liber).

### 6. Deschide aplicatia

Mergi la `http://localhost:5173` in browser.

---

## Cum folosesti aplicatia

1. **Cont nou** — apasa pe *Register*, introdu email, nume si parola. Sau apasa pe *Sign in with Google*.
2. **Login** — dupa inregistrare esti redirectat la *Login*; intra cu credentialele tale.
3. **Porneste un chat** — din pagina principala, cauta un utilizator dupa email/nume si incepe o conversatie.
4. **Chat de grup** — creeaza un chat nou, da-i nume si adauga participanti.
5. **Mesaje** — scrie in caseta de jos si apasa *Enter*. Atasamente: butonul de clip.
6. **Status** — schimba statusul (online/busy/away) din coltul de sus.
7. **Cautare** — foloseste bara de cautare din chat pentru a gasi mesaje mai vechi.

---

## Variabile de mediu

Toate sunt optionale (au valori default). Recomandate in productie:

| Variabila | Default | Descriere |
|-----------|---------|-----------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/chatapp` | URL PostgreSQL |
| `DB_USERNAME` | `postgres` | User DB |
| `DB_PASSWORD` | `1234` | Parola DB |
| `JWT_SECRET` | *(default insecure)* | Secret JWT — **schimba-l in productie** |
| `JWT_EXPIRATION_MS` | `86400000` (24h) | Durata token JWT |
| `GOOGLE_CLIENT_ID` | *(test)* | Google OAuth Client ID |
| `GCS_BUCKET` | `chatapp-attachments-2026` | Bucket GCS pentru atasamente |
| `GCS_CREDENTIALS_PATH` | *(local path)* | Cale fisier JSON credentiale GCS |
| `CLEANUP_RETENTION_DAYS` | `30` | Vechime mesaje sterse automat |

---

## Build pentru productie

Backend (jar executabil):
```bash
cd backend
./mvnw clean package
java -jar target/chatapp-backend-0.0.1-SNAPSHOT.jar
```

Frontend (build static):
```bash
cd frontend
npm run build
# rezultatul e in frontend/dist/
```

---

## Troubleshooting

| Problema | Cauza | Solutie |
|----------|-------|---------|
| `Connection refused` la pornirea backend-ului | PostgreSQL nu ruleaza | Porneste serviciul PostgreSQL |
| `password authentication failed` | Parola DB diferita de default | Seteaza `DB_PASSWORD` |
| Port 8081 ocupat | Alt proces foloseste portul | Schimba `server.port` in `application.properties` |
| Login Google nu merge | `GOOGLE_CLIENT_ID` lipsa/gresit | Configureaza Client ID-ul tau OAuth |
| Upload fisier esueaza | Credentiale GCS lipsa | Pune fisierul `gcs-credentials.json` sau dezactiveaza upload |
| Frontend nu se conecteaza la backend | CORS / port gresit | Verifica ca backend-ul ruleaza pe `:8081` |


---

## Licenta

Proiect academic — uz personal si educational.
