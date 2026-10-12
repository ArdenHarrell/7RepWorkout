/**
 * 7RepWorkout - member sign-up handler
 *
 * POST /api/subscribe   Body: { name, phone, email, consent, source, captchaToken, assessment? }
 *   New email      -> saves the member, emails a notification, returns { status: "created" }
 *   Existing email -> saves nothing, sends nothing, returns { status: "existing" }
 *
 * POST /api/lookup      Body: { email, captchaToken }
 *   Lets a returning visitor (who cleared their browser) get back in with just their email.
 *   Returns { found: true | false }.
 *
 * Both routes are reached through CloudFront on the site's own domain, so no CORS is needed.
 * Both require a valid CAPTCHA token when TURNSTILE_SECRET is set.
 * No health information is collected.
 *
 * Runtime: Node.js 22.x
 * Environment variables (set by the SAM template):
 *   TABLE_NAME        - DynamoDB table for members (key: email)
 *   NOTIFY_FROM       - verified SES "from" address
 *   NOTIFY_TO         - where notification emails are sent
 *   TURNSTILE_SECRET  - Cloudflare Turnstile secret key ("" turns the check off - testing only)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { randomUUID } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});

const TABLE_NAME       = process.env.TABLE_NAME;
const NOTIFY_FROM      = process.env.NOTIFY_FROM;
const NOTIFY_TO        = process.env.NOTIFY_TO;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESULTS = ["great", "probable", "notfit"];

// Never answer with 403 or 404 from here: CloudFront swaps those for the site's "page not found" page.
function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function sanitize(str, max) {
  if (typeof str !== "string") return "";
  // Drop control characters (also blocks header/line injection in the email body)
  return str.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

// Keep digits and a single leading "+". Returns "" if the result isn't 10-15 digits.
function normalizePhone(raw) {
  const s = sanitize(raw, 30);
  const digits = s.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  return (s.startsWith("+") ? "+" : "") + digits;
}

// The visitor's address. Behind CloudFront the first X-Forwarded-For entry is the real one.
function clientIp(event) {
  const forwarded = event.headers?.["x-forwarded-for"] || event.headers?.["X-Forwarded-For"] || "";
  const first = forwarded.split(",")[0];
  return sanitize(first || event.requestContext?.http?.sourceIp || "", 60);
}

// Checks the CAPTCHA token with Cloudflare. Anything other than a clear "success" counts as a failure.
async function verifyCaptcha(token, ip) {
  if (!TURNSTILE_SECRET) {
    console.warn("TURNSTILE_SECRET is not set: CAPTCHA check skipped.");
    return true;
  }
  if (!token) return false;
  try {
    const form = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token });
    if (ip) form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data.success !== true) console.warn("CAPTCHA rejected:", data["error-codes"]);
    return data.success === true;
  } catch (err) {
    console.error("CAPTCHA check failed:", err);
    return false;
  }
}

// Quiz answers: question ids like "q1" mapped to short answer codes (string or array of strings).
// Anything that doesn't match this shape is dropped, so the table can't be filled with arbitrary data.
function sanitizeAssessment(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const src = raw.answers;
  if (!src || typeof src !== "object" || Array.isArray(src)) return undefined;

  const answers = {};
  let count = 0;
  for (const [key, value] of Object.entries(src)) {
    if (count >= 20 || !/^q\d{1,2}$/.test(key)) continue;
    if (typeof value === "string") {
      const s = sanitize(value, 40);
      if (s) { answers[key] = s; count++; }
    } else if (Array.isArray(value)) {
      const list = value.slice(0, 10)
        .filter((v) => typeof v === "string")
        .map((v) => sanitize(v, 40))
        .filter(Boolean);
      if (list.length) { answers[key] = list; count++; }
    }
  }
  if (!count) return undefined;

  const out = { answers, result: RESULTS.includes(raw.result) ? raw.result : "unknown" };
  if (Number.isFinite(raw.score)) out.score = Math.max(-20, Math.min(20, Math.trunc(raw.score)));
  const completedAt = typeof raw.completedAt === "string" ? sanitize(raw.completedAt, 40) : "";
  if (completedAt) out.completedAt = completedAt;
  return out;
}

function assessmentSummary(a) {
  if (!a) return "";
  const lines = Object.entries(a.answers).map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  return `\nAssessment: ${a.result}${a.score !== undefined ? ` (score ${a.score})` : ""}\n${lines.join("\n")}\n`;
}

const CAPTCHA_FAILED = { message: "Please complete the verification check and try again." };

// ---------- POST /api/lookup ----------
async function lookup(event, payload) {
  const email = sanitize(payload.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return response(400, { message: "Please provide a valid email address." });
  }
  if (!(await verifyCaptcha(sanitize(payload.captchaToken, 2048), clientIp(event)))) {
    return response(400, CAPTCHA_FAILED);
  }

  try {
    const found = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { email },
      ProjectionExpression: "email",
    }));
    return response(200, { found: Boolean(found.Item) });
  } catch (err) {
    console.error("DynamoDB get failed:", err);
    return response(500, { message: "Could not check that email. Please try again." });
  }
}

// ---------- POST /api/subscribe ----------
async function subscribe(event, payload) {
  const name    = sanitize(payload.name, 120);
  const email   = sanitize(payload.email, 254).toLowerCase();
  const phone   = normalizePhone(payload.phone);
  const source  = sanitize(payload.source, 120);
  const consent = payload.consent === true;

  if (!name || !email || !payload.phone) {
    return response(400, { message: "Name, phone and email are required." });
  }
  if (!EMAIL_RE.test(email)) {
    return response(400, { message: "Please provide a valid email address." });
  }
  if (!phone) {
    return response(400, { message: "Please provide a valid phone number." });
  }
  if (!consent) {
    return response(400, { message: "Consent is required." });
  }

  const ip = clientIp(event);
  if (!(await verifyCaptcha(sanitize(payload.captchaToken, 2048), ip))) {
    return response(400, CAPTCHA_FAILED);
  }

  const now = new Date().toISOString();
  const item = {
    email,          // table key: one row per email address
    createdAt: now,
    id:        randomUUID(),
    name,
    phone,
    consent:   true,
    source:    source || "unknown",
    userAgent: sanitize(event.headers?.["user-agent"] || event.headers?.["User-Agent"] || "", 300),
    ip,
  };
  const assessment = sanitizeAssessment(payload.assessment);
  if (assessment) item.assessment = assessment;

  try {
    // The condition makes the save fail if this email is already in the table.
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(email)",
    }));
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      // Already a member: let them in, but don't overwrite their record or send another email.
      return response(200, { status: "existing", message: "Welcome back!" });
    }
    console.error("DynamoDB put failed:", err);
    return response(500, { message: "Could not save your sign-up. Please try again." });
  }

  // Notification email (best effort - don't fail the request if SES hiccups)
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: NOTIFY_FROM,
      Destination: { ToAddresses: [NOTIFY_TO] },
      Content: {
        Simple: {
          Subject: { Data: `New 7RepWorkout sign-up - ${name}`, Charset: "UTF-8" },
          Body: {
            Text: {
              Charset: "UTF-8",
              Data:
                `New sign-up on 7RepWorkout.com\n\n` +
                `Name:   ${name}\n` +
                `Phone:  ${phone}\n` +
                `Email:  ${email}\n` +
                `Source: ${item.source}\n` +
                `Time:   ${now}\n` +
                assessmentSummary(assessment),
            },
          },
        },
      },
    }));
  } catch (err) {
    console.error("SES notify failed (non-fatal):", err);
  }

  return response(200, { status: "created", message: "You're in - enjoy your workout!" });
}

export const handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { message: "Invalid JSON body." });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response(400, { message: "Invalid JSON body." });
  }

  const path = event.rawPath || event.requestContext?.http?.path || "";
  return path.endsWith("/lookup") ? lookup(event, payload) : subscribe(event, payload);
};
