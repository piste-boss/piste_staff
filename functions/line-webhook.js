/**
 * LINE Webhook プロキシ (Netlify Functions v1 — callback方式)
 * 先に 200 OK を LINE に返し、その後 GAS を呼ぶ
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = (event, context, callback) => {
  console.log("[line-webhook] method:", event.httpMethod);

  // LINE に即座に 200 OK を返す
  callback(null, {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  });

  // POST 以外は処理不要
  if (event.httpMethod !== "POST" || !event.body) return;

  const body = event.body;
  console.log("[line-webhook] body length:", body.length, "body:", body.slice(0, 200));

  // 200 返却後に GAS を呼ぶ（Lambda は event loop が空になるまで待つ）
  const encoded = Buffer.from(body, "utf-8").toString("base64");
  const gasUrl = `${GAS_URL}?lineWebhook=${encodeURIComponent(encoded)}`;
  console.log("[line-webhook] calling GAS, encoded length:", encoded.length);

  fetch(gasUrl, { method: "GET", redirect: "follow" })
    .then((res) => res.text())
    .then((text) => {
      console.log("[line-webhook] GAS response:", text.slice(0, 200));
    })
    .catch((error) => {
      console.error("[line-webhook] GAS error:", error);
    });
};
