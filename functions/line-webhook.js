/**
 * LINE Webhook プロキシ (Netlify Functions v1)
 * GAS の POST 302 リダイレクト問題を回避するため、
 * LINE の POST データを base64 エンコードして GAS に GET で渡す
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

  try {
    const body = event.body || "";
    console.log("[line-webhook] body length:", body.length);
    console.log("[line-webhook] body preview:", body.slice(0, 300));

    // POST body を base64 エンコードして GET パラメータで GAS に渡す
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const gasUrl = `${GAS_URL}?lineWebhook=${encodeURIComponent(encoded)}`;
    console.log("[line-webhook] GAS URL length:", gasUrl.length);

    const gasResponse = await fetch(gasUrl, {
      method: "GET",
      redirect: "follow",
    });

    const responseText = await gasResponse.text();
    console.log("[line-webhook] GAS status:", gasResponse.status);
    console.log("[line-webhook] GAS response:", responseText.slice(0, 500));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: responseText,
    };
  } catch (error) {
    console.error("[line-webhook] Proxy error:", error);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(error) }),
    };
  }
};
