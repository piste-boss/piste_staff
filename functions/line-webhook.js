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
    // GAS は 302 リダイレクトする。redirect:"follow" だと POST→GET に変わり body が消える。
    // 手動でリダイレクト先URLを取得し、再度 POST する。
    const res1 = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      redirect: "manual",
    });
    console.log("[line-webhook] GAS redirect status:", res1.status);

    const redirectUrl = res1.headers.get("location");
    if (redirectUrl) {
      console.log("[line-webhook] redirect to:", redirectUrl.slice(0, 100));
      const res2 = await fetch(redirectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        redirect: "follow",
      });
      const text = await res2.text();
      console.log("[line-webhook] GAS final status:", res2.status, "response:", text.slice(0, 200));
    } else {
      const text = await res1.text();
      console.log("[line-webhook] GAS no redirect, status:", res1.status, "response:", text.slice(0, 200));
    }
  } catch (error) {
    console.error("[line-webhook] error:", error);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
