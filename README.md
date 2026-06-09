# Aviel — Aplicație de chat în timp real

---

## 1. Tehnologii

**Backend**
- Java 21, Spring Boot 3.3.4, Maven
- Spring Web (REST), Spring Security, Spring Data JPA (Hibernate)
- WebSocket (STOMP) pentru mesaje în timp real și prezență
- PostgreSQL
- Autentificare cu JWT și Google OAuth (Google Identity Services)
- Google Cloud Storage (GCS) pentru stocarea atașamentelor

**Frontend**
- React + Vite
- axios (HTTP), STOMP/SockJS (WebSocket)
- Google Identity Services pentru login cu Google

---

## 2. Cerințe preliminare

Înainte de a rula aplicația, trebuie instalate:

- **JDK 21** (`java -version` trebuie să afișeze versiunea 21)
- **Maven 3.9+** (sau folosești wrapper-ul `mvnw` din proiect)
- **Node.js 18+** și **npm**
- **PostgreSQL 14+** pornit local
- Un **proiect Google Cloud** cu:
  - un **OAuth Client ID** (tip „Web application”) pentru login,
  - un **bucket GCS** și un fișier de **credențiale de service account** (`gcs-credentials.json`) pentru atașamente.

---

## 3. Configurarea bazei de date

Creează baza de date în PostgreSQL:

```sql
CREATE DATABASE chatapp;
```

Schema (tabelele) se generează automat la prima pornire a backend-ului — `spring.jpa.hibernate.ddl-auto=update` creează și actualizează tabelele. Nu trebuie să rulezi manual scripturi SQL.

---

## 4. Configurare (variabile de mediu)

| Variabilă | Descriere | Valoare implicită |
|---|---|---|
| `DB_URL` | URL-ul bazei PostgreSQL | `jdbc:postgresql://localhost:5432/chatapp` |
| `DB_USERNAME` | Utilizator DB | `postgres` |
| `DB_PASSWORD` | Parolă DB | `****` |
| `JWT_SECRET` | Cheie de semnare a token-urilor JWT (string lung, secret) | *(setează-l tu)* |
| `JWT_EXPIRATION_MS` | Durata de viață a token-ului (ms) | `86400000` (24h) |
| `GOOGLE_CLIENT_ID` | OAuth Client ID din Google Cloud | *(setează-l tu)* |
| `GCS_PROJECT_ID` | ID-ul proiectului Google Cloud | `chat-app-497015` |
| `GCS_BUCKET` | Numele bucket-ului GCS | `chatapp-attachments-2026` |
| `CLEANUP_RETENTION_DAYS` | Câte zile se păstrează mesajele șterse | `30` |

**Frontend** — în folderul `frontend`, fișierul `.env`:

```
VITE_GOOGLE_CLIENT_ID=acelasi_client_id_ca_la_backend
```

`GOOGLE_CLIENT_ID` (backend) și `VITE_GOOGLE_CLIENT_ID` (frontend) trebuie să fie **identice** — altfel login-ul cu Google eșuează.

---

## 5. Rularea aplicației

Aplicația are două componente care rulează în paralel. Pornește-le în două terminale separate.

### 5.1. Backend (port 8081)

```bash
cd backend
./mvnw spring-boot:run        # Linux/macOS
mvnw.cmd spring-boot:run      # Windows
# sau, dacă ai Maven instalat global:
mvn spring-boot:run
```

API-ul va fi disponibil la `http://localhost:8081`.
Verifică starea cu endpoint-ul de health: `http://localhost:8081/api/health`.

### 5.2. Frontend (port 5173)

```bash
cd frontend
npm install        # doar prima dată
npm run dev
```

Deschide în browser adresa afișată în terminal (de regulă `http://localhost:5173`).

### 5.3. Flux de utilizare

1. Deschide frontend-ul în browser.
2. Autentifică-te cu un cont Google (butonul de login Google).
3. Caută utilizatori și începe o conversație 1-la-1 sau creează un grup.
4. Trimite mesaje text și atașamente (max. 20 MB/fișier). Mesajele apar în timp real prin WebSocket.
5. Statusul de prezență și confirmările de citire se actualizează automat.

---

## 6. Build pentru producție

**Backend** (generează un JAR executabil):

```bash
cd backend
./mvnw clean package
java -jar target/chatapp-backend-0.0.1-SNAPSHOT.jar
```

**Frontend** (generează fișiere statice în `frontend/dist`):

```bash
cd frontend
npm run build
npm run preview   # opțional, pentru a testa build-ul local
```


---

## 7. Structura proiectului

```
Chat App/
├── backend/                 # Spring Boot (API REST + WebSocket)
│   ├── src/main/java/com/chatapp/
│   │   ├── config/          # Securitate, WebSocket, prezență
│   │   ├── controller/      # Endpoint-uri REST și WebSocket
│   │   ├── dto/             # Obiecte de transfer de date
│   │   ├── entity/          # Entități JPA (User, Chat, Message, ...)
│   │   ├── repository/      # Acces la date (Spring Data JPA)
│   │   ├── security/        # JWT, autentificare Google
│   │   └── service/         # Logica de business
│   └── src/main/resources/
│       └── application.properties
├── frontend/                # React + Vite
│   ├── src/                 # Cod sursă (componente, hooks)
│   ├── index.html
│   └── .env
└── docs/                    # Diagrame UML (arhitectură, clase, etc.)
```

