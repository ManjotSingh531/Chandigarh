const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const nodemailer = require("nodemailer");
const { URL } = require("url");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const API_KEY = process.env.AVIATIONSTACK_API_KEY || "";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "";
const AIRPORT_CODE = "IXC";
const ROOT_DIR = __dirname;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function collectBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function sendContactEmail({ name, email, subject, message }) {
  if (!SMTP_USER || !SMTP_PASS || !CONTACT_TO_EMAIL) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: SMTP_USER,
    to: CONTACT_TO_EMAIL,
    replyTo: email,
    subject: `[Contact Form] ${subject}`,
    html:
      `<h3>New Contact Message</h3>` +
      `<p><strong>Name:</strong> ${name}</p>` +
      `<p><strong>Email:</strong> ${email}</p>` +
      `<p><strong>Subject:</strong> ${subject}</p>` +
      `<p><strong>Message:</strong><br>${message.replace(/\n/g, "<br>")}</p>`
  });

  return true;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".otf": "font/otf"
  };

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(data);
  });
}

function requestJson(urlString) {
  return new Promise((resolve, reject) => {
    https
      .get(urlString, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error("Invalid JSON received from Aviationstack"));
          }
        });
      })
      .on("error", reject);
  });
}

function normalizeFlights(payload) {
  const items = (payload && (payload.data || payload.results)) || [];

  return items.map((flight) => ({
    airline: {
      name: (flight.airline && (flight.airline.name || flight.airline.airline_name)) || "Unknown airline",
      iata: (flight.airline && flight.airline.iata) || ""
    },
    flight: {
      iata: (flight.flight && (flight.flight.iata || flight.flight.number)) || "Unavailable"
    },
    departure: {
      airport: (flight.departure && flight.departure.airport) || "",
      iata: (flight.departure && flight.departure.iata) || "",
      scheduled: (flight.departure && (flight.departure.scheduled || flight.departure.estimated)) || "",
      terminal: (flight.departure && flight.departure.terminal) || "",
      gate: (flight.departure && flight.departure.gate) || "",
      delay: (flight.departure && flight.departure.delay) || ""
    },
    arrival: {
      airport: (flight.arrival && flight.arrival.airport) || "",
      iata: (flight.arrival && flight.arrival.iata) || "",
      scheduled: (flight.arrival && (flight.arrival.scheduled || flight.arrival.estimated)) || "",
      terminal: (flight.arrival && flight.arrival.terminal) || "",
      gate: (flight.arrival && flight.arrival.gate) || "",
      baggage: (flight.arrival && flight.arrival.baggage) || ""
    },
    flight_status: flight.flight_status || flight.status || "scheduled"
  }));
}

function uniqueAirlines(flights) {
  const seen = new Map();

  flights.forEach((flight) => {
    const name = flight.airline && flight.airline.name;

    if (name && !seen.has(name)) {
      seen.set(name, {
        name,
        iata: (flight.airline && flight.airline.iata) || ""
      });
    }
  });

  return Array.from(seen.values());
}

function topRoutes(flights, key) {
  const counts = new Map();

  flights.forEach((flight) => {
    const route = flight[key] && (flight[key].airport || flight[key].iata);
    if (route) {
      counts.set(route, (counts.get(route) || 0) + 1);
    }
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => ({
      name: entry[0],
      flights: entry[1]
    }));
}

async function getAirportOverview() {
  if (!API_KEY) {
    throw new Error("AVIATIONSTACK_API_KEY is missing. Add it to your .env file.");
  }

  const departuresUrl = new URL("https://api.aviationstack.com/v1/flights");
  departuresUrl.searchParams.set("access_key", API_KEY);
  departuresUrl.searchParams.set("dep_iata", AIRPORT_CODE);
  departuresUrl.searchParams.set("limit", "8");

  const arrivalsUrl = new URL("https://api.aviationstack.com/v1/flights");
  arrivalsUrl.searchParams.set("access_key", API_KEY);
  arrivalsUrl.searchParams.set("arr_iata", AIRPORT_CODE);
  arrivalsUrl.searchParams.set("limit", "8");

  const [departuresRaw, arrivalsRaw] = await Promise.all([
    requestJson(departuresUrl.toString()),
    requestJson(arrivalsUrl.toString())
  ]);

  if (departuresRaw.error) {
    throw new Error(departuresRaw.error.message || "Aviationstack departure request failed");
  }

  if (arrivalsRaw.error) {
    throw new Error(arrivalsRaw.error.message || "Aviationstack arrival request failed");
  }

  const departures = normalizeFlights(departuresRaw);
  const arrivals = normalizeFlights(arrivalsRaw);
  const airlines = uniqueAirlines(departures.concat(arrivals));

  return {
    airport: {
      name: "Chandigarh Airport",
      iata: AIRPORT_CODE,
      city: "Chandigarh",
      country: "India",
      distance_from_city_km: 11
    },
    summary: {
      live_departures: departures.length,
      live_arrivals: arrivals.length,
      active_airlines: airlines.length,
      top_departure_routes: topRoutes(departures, "arrival"),
      top_arrival_routes: topRoutes(arrivals, "departure")
    },
    airlines,
    departures: {
      data: departures
    },
    arrivals: {
      data: arrivals
    },
    updated_at: new Date().toISOString(),
    source: "aviationstack"
  };
}

async function getAirportDataSections() {
  const overview = await getAirportOverview();

  return {
    overview,
    departures: overview.departures,
    arrivals: overview.arrivals,
    airlines: {
      airport: overview.airport.iata,
      data: overview.airlines
    },
    summary: {
      airport: overview.airport.iata,
      data: overview.summary
    }
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "chandigarh-aviation-server" });
    return;
  }

  if ((pathname === "/api/contact" || pathname === "/sendmail.php") && req.method === "POST") {
    try {
      const rawBody = await collectBody(req);
      const form = querystring.parse(rawBody);

      const name = String(form.name || "").trim();
      const email = String(form.email || "").trim();
      const subject = String(form.subject || "").trim();
      const message = String(form.message || "").trim();

      if (!name || !email || !subject || !message) {
        sendRedirect(res, "/contact.html?sent=0");
        return;
      }

      const entry =
        `\n---\n` +
        `time: ${new Date().toISOString()}\n` +
        `name: ${name}\n` +
        `email: ${email}\n` +
        `subject: ${subject}\n` +
        `message: ${message.replace(/\r?\n/g, " ")}\n`;

      fs.appendFile(path.join(ROOT_DIR, "contact-submissions.log"), entry, async () => {
        try {
          const emailed = await sendContactEmail({ name, email, subject, message });
          sendRedirect(res, emailed ? "/contact.html?sent=1" : "/contact.html?sent=2");
        } catch (error) {
          sendRedirect(res, "/contact.html?sent=2");
        }
      });
    } catch (error) {
      sendRedirect(res, "/contact.html?sent=0");
    }
    return;
  }

  if (pathname === "/api/airport/overview") {
    try {
      const overview = await getAirportOverview();
      sendJson(res, 200, overview);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message,
        hint: "Check your Aviationstack key, plan limits, or network access."
      });
    }
    return;
  }

  if (pathname === "/api/airport/departures") {
    try {
      const airportData = await getAirportDataSections();
      sendJson(res, 200, airportData.departures);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message,
        hint: "Check your Aviationstack key, plan limits, or network access."
      });
    }
    return;
  }

  if (pathname === "/api/airport/arrivals") {
    try {
      const airportData = await getAirportDataSections();
      sendJson(res, 200, airportData.arrivals);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message,
        hint: "Check your Aviationstack key, plan limits, or network access."
      });
    }
    return;
  }

  if (pathname === "/api/airport/airlines") {
    try {
      const airportData = await getAirportDataSections();
      sendJson(res, 200, airportData.airlines);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message,
        hint: "Check your Aviationstack key, plan limits, or network access."
      });
    }
    return;
  }

  if (pathname === "/api/airport/summary") {
    try {
      const airportData = await getAirportDataSections();
      sendJson(res, 200, airportData.summary);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message,
        hint: "Check your Aviationstack key, plan limits, or network access."
      });
    }
    return;
  }

  let filePath = path.join(ROOT_DIR, pathname === "/" ? "index.html" : pathname);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    sendFile(res, filePath);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Chandigarh aviation server running at http://${HOST}:${PORT}`);
});
