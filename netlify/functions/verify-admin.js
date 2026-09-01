const crypto = require("crypto");

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { authorized: false });

  const expected = process.env.CFC_ADMIN_PASSWORD;
  if (!expected) return json(503, { authorized: false, error: "La clave administrativa no está configurada." });

  let supplied = "";
  try {
    supplied = String(JSON.parse(event.body || "{}").password || "");
  } catch (error) {
    return json(400, { authorized: false });
  }

  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const suppliedHash = crypto.createHash("sha256").update(supplied).digest();
  const authorized = crypto.timingSafeEqual(expectedHash, suppliedHash);
  return json(authorized ? 200 : 401, { authorized });
};
