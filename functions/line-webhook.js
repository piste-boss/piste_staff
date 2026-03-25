/**
 * LINE Webhook プロキシ (Netlify Functions)
 * GAS リダイレクトでパラメータが消えるため、
 * 先にリダイレクト先URLを取得してからパラメータ付きで呼ぶ
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = (event, context, callback) => {
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

  // Step 1: GAS のリダイレクト先URL を取得
  // Step 2: そのURLにパラメータ付きで GET
  const encoded = Buffer.from(body, "utf-8").toString("base64");

  fetch(GAS_URL, { method: "GET", redirect: "manual" })
    .then((res) => {
      const redirectUrl = res.headers.get("location");
      console.log("[line-webhook] redirect:", redirectUrl ? redirectUrl.slice(0, 100) : "none");
      if (!redirectUrl) throw new Error("No redirect from GAS");

      const sep = redirectUrl.includes("?") ? "&" : "?";
      const finalUrl = `${redirectUrl}${sep}lineWebhook=${encodeURIComponent(encoded)}`;
      console.log("[line-webhook] final url length:", finalUrl.length);

      return fetch(finalUrl, { method: "GET", redirect: "follow" });
    })
    .then((res) => res.text())
    .then((text) => console.log("[line-webhook] GAS response:", text.slice(0, 200)))
    .catch((err) => console.error("[line-webhook] error:", err));
};
