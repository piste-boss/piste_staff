/**
 * LINE Webhook プロキシ (Netlify Functions v1)
 * LINE の POST body をそのまま GAS doPost へ転送
 * → GAS が body.events を検出し handleLineWebhook_ を直接呼ぶ
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = async (event) => {
  console.log("[line-webhook] method:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  }

  const body = event.body || "";
  console.log("[line-webhook] body length:", body.length, "body:", body.slice(0, 200));

  try {
    // LINE の body をそのまま POST で GAS に転送
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      redirect: "follow",
    });
    const text = await res.text();
    console.log("[line-webhook] GAS status:", res.status, "response:", text.slice(0, 200));
  } catch (error) {
    console.error("[line-webhook] error:", error);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
