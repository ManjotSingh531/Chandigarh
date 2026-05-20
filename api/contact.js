const nodemailer = require("nodemailer");
const querystring = require("querystring");

const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "";

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function didAcceptRecipient(info, recipientEmail) {
  const accepted = Array.isArray(info && info.accepted) ? info.accepted.map((item) => String(item).toLowerCase()) : [];
  const rejected = Array.isArray(info && info.rejected) ? info.rejected.map((item) => String(item).toLowerCase()) : [];
  const normalizedTarget = String(recipientEmail || "").toLowerCase();

  return accepted.includes(normalizedTarget) && !rejected.includes(normalizedTarget);
}

async function sendContactEmail({ name, email, subject, message }) {
  if (!SMTP_USER || !SMTP_PASS) {
    return false;
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const userInfo = await transporter.sendMail({
    from: SMTP_USER,
    to: email,
    subject: "Thank you for contacting Chandigarh Tourism",
    html:
      `<div style="margin:0;padding:24px;background:#f4f8ff;font-family:Arial,sans-serif;color:#16243a;">` +
      `<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe8ff;">` +
      `<div style="background:linear-gradient(135deg,#1d4ed8,#0f766e);padding:28px 24px;color:#ffffff;">` +
      `<h1 style="margin:0;font-size:24px;line-height:1.3;">Thank You, ${safeName}!</h1>` +
      `<p style="margin:10px 0 0;font-size:15px;opacity:0.95;">Your message has been received by Chandigarh Tourism.</p>` +
      `</div>` +
      `<div style="padding:22px 24px;">` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">We appreciate you reaching out. Our team will review your message and respond soon.</p>` +
      `<div style="background:#f8fbff;border:1px solid #e5edff;border-radius:10px;padding:14px 16px;">` +
      `<p style="margin:0 0 8px;font-size:13px;color:#3a5174;text-transform:uppercase;letter-spacing:0.5px;">Your submission details</p>` +
      `<p style="margin:0 0 6px;font-size:14px;"><strong>Subject:</strong> ${safeSubject}</p>` +
      `<p style="margin:0;font-size:14px;"><strong>Message:</strong><br>${safeMessage}</p>` +
      `</div>` +
      `<p style="margin:16px 0 0;font-size:14px;color:#42526e;">Warm regards,<br><strong>Chandigarh Tourism Team</strong></p>` +
      `</div>` +
      `</div>` +
      `</div>`
  });

  if (!didAcceptRecipient(userInfo, email)) {
    throw new Error("User thank-you email not accepted by SMTP server");
  }

  if (CONTACT_TO_EMAIL) {
    try {
      await transporter.sendMail({
        from: SMTP_USER,
        to: CONTACT_TO_EMAIL,
        replyTo: email,
        subject: `[Contact Form] ${subject}`,
        html:
          `<h3>New Contact Message</h3>` +
          `<p><strong>Name:</strong> ${safeName}</p>` +
          `<p><strong>Email:</strong> ${safeEmail}</p>` +
          `<p><strong>Subject:</strong> ${safeSubject}</p>` +
          `<p><strong>Message:</strong><br>${safeMessage}</p>`
      });
    } catch (error) {
      console.error("Admin contact email failed:", error && error.message ? error.message : error);
    }
  }

  return true;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

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

    const emailed = await sendContactEmail({ name, email, subject, message });
    sendRedirect(res, emailed ? "/contact.html?sent=1" : "/contact.html?sent=2");
  } catch (error) {
    console.error("Contact API failed:", error && error.message ? error.message : error);
    sendRedirect(res, "/contact.html?sent=2");
  }
};
