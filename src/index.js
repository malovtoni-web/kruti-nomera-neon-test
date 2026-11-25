
async function sendMessage(token, chatId, text) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );

  return response.ok;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        database: Boolean(env.DB),
        botToken: Boolean(env.BOT_TOKEN)
      });
    }

    // Настройка webhook
    if (url.pathname === "/api/setup-webhook") {
      if (url.searchParams.get("key") !== env.SETUP_SECRET) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      if (!env.BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
        return Response.json(
          { error: "Missing bot secrets" },
          { status: 500 }
        );
      }

      const result = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: `${url.origin}/api/telegram/webhook`,
            secret_token: env.TELEGRAM_WEBHOOK_SECRET
          })
        }
      );

      return Response.json(await result.json());
    }

    // Получение сообщений от Telegram
    if (url.pathname === "/api/telegram/webhook") {
      if (
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
        env.TELEGRAM_WEBHOOK_SECRET
      ) {
        return new Response("Forbidden", { status: 403 });
      }

      const update = await request.json();
      const message = update.message;
      const chatId = message?.chat?.id;
      const text = message?.text || "";

      if (chatId && text.startsWith("/start")) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "Добро пожаловать в «Крути Номера»! 🎮\n\nНажми кнопку «Играть», чтобы открыть игру.\n\nСкоро здесь появится привязка браузера."
        );
      } else if (chatId && text.startsWith("/help")) {
        await sendMessage(
          env.BOT_TOKEN,
          chatId,
          "Помощь по игре «Крути Номера» 🎮\n\n/start — запуск бота\n/help — помощь\n\nИгру можно открыть кнопкой «Играть»."
        );
      }

      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "Not implemented yet" },
        { status: 501 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
