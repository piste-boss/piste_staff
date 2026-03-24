/**
 * LINE Webhook プロキシ (Netlify Functions v1)
 * GAS に POST を転送。GAS は doPost 実行時に LINE Reply API を直接呼ぶため、
 * GAS のレスポンスを待つ必要はない。
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
  console.log("[line-webhook] body:", body.slice(0, 300));

  // GAS に POST で転送（redirect: manual で302を取得、その後GETで追従）
  // GAS は doPost 実行時に sendLineReply_ を呼ぶので、
  // レスポンスの中身は重要ではない
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      redirect: "manual",
    });
    console.log("[line-webhook] GAS initial status:", res.status);

    // 302 の場合、リダイレクト先をGETで取得（レスポンス確認用）
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      console.log("[line-webhook] redirect to:", location ? location.slice(0, 100) : "none");
      if (location) {
        const res2 = await fetch(location, { method: "GET", redirect: "follow" });
        const text = await res2.text();
        console.log("[line-webhook] GAS response:", text.slice(0, 200));
      }
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
