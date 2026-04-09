const { sendJson } = require("./_lib/aviation");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 200, { ok: true, service: "chandigarh-aviation-server" });
};
