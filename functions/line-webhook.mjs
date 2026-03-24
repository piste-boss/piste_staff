/**
 * LINE Webhook プロキシ (Netlify Functions v2)
 * LINE に即座に 200 を返し、GAS への転送は waitUntil でバックグラウンド実行
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.text();
  console.log("[line-webhook] received, body length:", body.length);

  // GAS への転送をバックグラウンドで実行
  context.waitUntil(forwardToGAS(body));

  // LINE に即座に 200 OK を返す
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

async function forwardToGAS(body) {
  try {
    const encoded = btoa(unescape(encodeURIComponent(body)));
    const gasUrl = `${GAS_URL}?lineWebhook=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] forwarding to GAS, URL length:", gasUrl.length);

    const res = await fetch(gasUrl, { method: "GET", redirect: "follow" });
    const text = await res.text();
    console.log("[line-webhook] GAS status:", res.status, "response:", text.slice(0, 300));
  } catch (error) {
    console.error("[line-webhook] GAS forward error:", error);
  }
}

export const config = {
  path: "/api/line-webhook",
};
