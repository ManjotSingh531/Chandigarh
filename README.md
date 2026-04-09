# CHANDIGARH TOURISM

## Local aviation server

Run the project with:

```bash
node server.js
```

Open:

```bash
http://localhost:3000/howtoreach.html
```

Set up environment file:

```bash
cp .env.example .env
```

Then edit `.env` and add your real `AVIATIONSTACK_API_KEY`.

Start server:

```bash
node server.js
```

`.env` is ignored by git via `.gitignore`, so your API key stays private.

Postman collection:

`Chandigarh-Aviation.postman_collection.json`

Available `GET` endpoints:

```text
/api/health
/api/airport/overview
/api/airport/departures
/api/airport/arrivals
/api/airport/airlines
/api/airport/summary
```
