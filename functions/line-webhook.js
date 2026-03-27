/**
 * LINE Webhook プロキシ (Netlify Functions)
 * LINE → Netlify Function → GAS (GET + base64)
 * タイムアウト対策: リダイレクトをfollowして直接送信
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

exports.handler = async (event) => {
  console.log("[line-webhook] method:", event.httpMethod);

  // LINE の検証リクエスト（GET）やbodyなしは即200返却
  if (event.httpMethod !== "POST" || !event.body) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  }

  const body = event.body;
  console.log("[line-webhook] body:", body.slice(0, 200));

  // LINEには先に200を返すためバックグラウンドで処理
  // ただしNetlify Functionsではawaitしないと処理が切れるのでawaitする
  try {
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const url = `${GAS_URL}?type=linewebhook&data=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] sending to GAS, url length:", url.length);

    // redirect: "follow" で自動的にリダイレクト先に到達
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25秒タイムアウト

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

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
