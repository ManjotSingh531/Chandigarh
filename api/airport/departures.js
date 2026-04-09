const { sendJson, getAirportDataSections } = require("../_lib/aviation");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const airportData = await getAirportDataSections();
    sendJson(res, 200, airportData.departures);
  } catch (error) {
    sendJson(res, 500, {
      error: error.message,
      hint: "Check AVIATIONSTACK key, plan limits, network access, and Vercel environment variables."
    });
  }
};
