/**
 * LINE Webhook プロキシ (Netlify Functions)
 * LINE → Netlify Function → GAS (GET + base64)
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = async (event) => {
  console.log("[line-webhook] method:", event.httpMethod);

  if (event.httpMethod !== "POST" || !event.body) {
    return { statusCode: 200, body: '{"ok":true}' };
  }

  const body = event.body;
  console.log("[line-webhook] body:", body.slice(0, 200));

  // LINE検証リクエスト（eventsが空）は即200返却
  try {
    const parsed = JSON.parse(body);
    if (!parsed.events || parsed.events.length === 0) {
      console.log("[line-webhook] verification request, returning 200 immediately");
      return { statusCode: 200, body: '{"ok":true}' };
    }
  } catch (e) {
    // パース失敗でもOK返却
    return { statusCode: 200, body: '{"ok":true}' };
  }

  // 実際のWebhookイベントをGASに転送
  try {
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const url = `${GAS_URL}?type=linewebhook&data=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] sending to GAS, url length:", url.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    console.log("[line-webhook] GAS response status:", res.status, "body:", text.slice(0, 300));
  } catch (err) {
    console.error("[line-webhook] error:", err.name === "AbortError" ? "timeout (25s)" : err);
  }

  return { statusCode: 200, body: '{"ok":true}' };
};
