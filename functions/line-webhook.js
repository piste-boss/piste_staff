/**
 * LINE Webhook プロキシ (Netlify Functions)
 * callbackWaitsForEmptyEventLoop=false で即座に200を返す
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = (event, context, callback) => {
  // ★これが重要: callback後すぐレスポンスを返す（GAS完了を待たない）
  context.callbackWaitsForEmptyEventLoop = false;

  console.log("[line-webhook] method:", event.httpMethod);

  if (event.httpMethod !== "POST" || !event.body) {
    callback(null, {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    return;
  }

  const body = event.body;
  console.log("[line-webhook] body:", body.slice(0, 200));

  // LINE に即座に 200 OK を返す
  callback(null, {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  });

  // 200返却後にGASを呼ぶ
  const encoded = Buffer.from(body, "utf-8").toString("base64");
  const gasUrl = `${GAS_URL}?lineWebhook=${encodeURIComponent(encoded)}`;
  console.log("[line-webhook] calling GAS, url length:", gasUrl.length);

  fetch(gasUrl, { method: "GET", redirect: "follow" })
    .then((res) => res.text())
    .then((text) => console.log("[line-webhook] GAS response:", text.slice(0, 200)))
    .catch((err) => console.error("[line-webhook] GAS error:", err));
};
