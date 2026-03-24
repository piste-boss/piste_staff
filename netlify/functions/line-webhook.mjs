/**
 * LINE Webhook プロキシ
 * GAS の POST 302 リダイレクト問題を回避するため、
 * LINE の POST データを base64 エンコードして GAS に GET で渡す
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.text();

    // POST body を base64 エンコードして GET パラメータで GAS に渡す
    const encoded = btoa(unescape(encodeURIComponent(body)));
    const gasUrl = `${GAS_URL}?lineWebhook=${encodeURIComponent(encoded)}`;

    const gasResponse = await fetch(gasUrl, {
      method: "GET",
      redirect: "follow",
    });

    const responseText = await gasResponse.text();

    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/line-webhook",
};
