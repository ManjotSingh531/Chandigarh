const https = require("https");
const { URL } = require("url");

const AIRPORT_CODE = "IXC";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload, null, 2));
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
  const apiKey = process.env.AVIATIONSTACK_API_KEY || "";

  if (!apiKey) {
    throw new Error("AVIATIONSTACK_API_KEY is missing in environment variables.");
  }

  const departuresUrl = new URL("https://api.aviationstack.com/v1/flights");
  departuresUrl.searchParams.set("access_key", apiKey);
  departuresUrl.searchParams.set("dep_iata", AIRPORT_CODE);
  departuresUrl.searchParams.set("limit", "8");

  const arrivalsUrl = new URL("https://api.aviationstack.com/v1/flights");
  arrivalsUrl.searchParams.set("access_key", apiKey);
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

module.exports = {
  sendJson,
  getAirportOverview,
  getAirportDataSections
};
