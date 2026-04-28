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

To receive Contact form emails via Gmail SMTP, also set:

```bash
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASS=your_gmail_app_password
CONTACT_TO_EMAIL=your_email@example.com
```

Create Gmail App Password:

1. Google Account -> Security
2. Enable 2-Step Verification
3. App passwords -> create one for Mail
4. Use that generated password as `SMTP_PASS`

If email is not configured, submissions are still saved in `contact-submissions.log`.

Start server:

```bash
node server.js
```

`.env` is ignored by git via `.gitignore`, so your API key stays private.

## Deployment (Vercel)

This repo now includes Vercel serverless functions under `api/`, so `/api/health` and `/api/airport/*` work directly on Vercel.

Set this in Vercel:

1. Project -> Settings -> Environment Variables
2. Add `AVIATIONSTACK_API_KEY` with your real key
3. Redeploy

Notes:

- Do not upload `.env` to git.
- `PORT` and `HOST` are not required on Vercel serverless functions.
- Keep using local `.env` for local `node server.js`.

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
