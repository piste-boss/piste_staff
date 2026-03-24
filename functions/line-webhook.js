/**
 * LINE Webhook プロキシ (Netlify Functions v1)
 * LINE の POST データを GAS の既存ルーティング(type=linewebhook)経由で処理
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
  console.log("[line-webhook] body length:", body.length);

  try {
    // type=linewebhook&data=base64 で GAS の handle_ ルーティングを使う
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const gasUrl = `${GAS_URL}?type=linewebhook&data=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] calling GAS with type=linewebhook");

    const res = await fetch(gasUrl, { method: "GET", redirect: "follow" });
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
