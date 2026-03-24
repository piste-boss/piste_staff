/**
 * LINE Webhook プロキシ
 * GAS の 302 リダイレクト問題を回避するため、
 * LINE → Netlify Function → GAS と中継する
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzK4M1R53aYdoznEgnxVeJVA6u5EpSKptrexvvqYh8jMSYiLIjprgXNOleAf2uWRbMyWg/exec";

export default async (request) => {
  // LINE Webhook は POST のみ
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.text();

    // GAS に転送（fetch はリダイレクトを自動追従する）
    const gasResponse = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
      redirect: "follow",
    });

    const responseText = await gasResponse.text();

    // LINE には 200 OK を返す
    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    // エラーでも LINE には 200 を返す（リトライ防止）
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/line-webhook",
};
