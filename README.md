# Chat App

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

Optional: un cont Google Cloud 

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

## Setup 

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

## Variabile de mediu

Toate sunt optionale (au valori default).

| Variabila | Default | Descriere |
|-----------|---------|-----------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/chatapp` | URL PostgreSQL |
| `DB_USERNAME` | `postgres` | User DB |
| `DB_PASSWORD` | `1234` | Parola DB |
| `JWT_SECRET` | *(default insecure)* | Secret JWT — **schimba-l in prod** |
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

## Citare

Daca folositi acest proiect intr-o lucrare academica sau alta publicatie, va rugam sa il citati astfel:

> Nenișcă, A. (2026). *AVIEL: Aplicație de mesagerie instantanee cu arhitectură full-stack* (Lucrare de licență). Universitatea Babeș-Bolyai, Facultatea de Științe Economice și Gestiunea Afacerilor, Cluj-Napoca.

