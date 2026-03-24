/**
 * LINE Webhook プロキシ
 * GAS の POST 302 リダイレクト問題を回避するため、
 * LINE の POST データを base64 エンコードして GAS に GET で渡す
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

export default async (request) => {
  console.log("[line-webhook] method:", request.method, "url:", request.url);

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, method: request.method }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.text();
    console.log("[line-webhook] body length:", body.length);
    console.log("[line-webhook] body preview:", body.slice(0, 300));

    // POST body を base64 エンコードして GET パラメータで GAS に渡す
    const encoded = btoa(unescape(encodeURIComponent(body)));
    const gasUrl = `${GAS_URL}?lineWebhook=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] GAS URL length:", gasUrl.length);

    const gasResponse = await fetch(gasUrl, {
      method: "GET",
      redirect: "follow",
    });

    const responseText = await gasResponse.text();
    console.log("[line-webhook] GAS status:", gasResponse.status);
    console.log("[line-webhook] GAS response:", responseText.slice(0, 500));

    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[line-webhook] Proxy error:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/line-webhook",
};
