/**
 * LINE Webhook プロキシ (Netlify Functions)
 * GAS は 302 リダイレクトで POST→GET 変換＆パラメータ消失する。
 * 対策: 先にリダイレクト先URLを取得し、そこにパラメータ付きで直接GETする。
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = async (event) => {
  console.log("[line-webhook] method:", event.httpMethod);

  if (event.httpMethod !== "POST" || !event.body) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  }

  const body = event.body;
  console.log("[line-webhook] body:", body.slice(0, 200));

  try {
    // Step 1: GAS のリダイレクト先URL を取得（パラメータなし）
    const res1 = await fetch(GAS_URL, { method: "GET", redirect: "manual" });
    const redirectUrl = res1.headers.get("location");
    console.log("[line-webhook] redirect url:", redirectUrl ? redirectUrl.slice(0, 120) : "NONE");

    if (!redirectUrl) {
      console.error("[line-webhook] no redirect url");
      return { statusCode: 200, body: '{"ok":true}' };
    }

    // Step 2: リダイレクト先URLにパラメータ付きで直接 GET
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const sep = redirectUrl.includes("?") ? "&" : "?";
    const finalUrl = `${redirectUrl}${sep}lineWebhook=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] final url length:", finalUrl.length);

    const res2 = await fetch(finalUrl, { method: "GET", redirect: "follow" });
    const text = await res2.text();
    console.log("[line-webhook] GAS response:", text.slice(0, 300));
  } catch (err) {
    console.error("[line-webhook] error:", err);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
