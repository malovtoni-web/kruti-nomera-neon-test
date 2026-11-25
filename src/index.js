
async function verifyTelegramInitData(initData, botToken) {
 if (!initData || !botToken) return null;
 const params=new URLSearchParams(initData), suppliedHash=params.get('hash'), authDate=Number(params.get('auth_date')||0);
 if(!suppliedHash||!authDate||Math.abs(Date.now()/1000-authDate)>86400)return null;
 params.delete('hash'); const checkString=[...params.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[0]+'='+x[1]).join('\n');
 const enc=new TextEncoder(); const k0=await crypto.subtle.importKey('raw',enc.encode('WebAppData'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const secret=await crypto.subtle.sign('HMAC',k0,enc.encode(botToken)); const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(checkString))); const actual=[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(actual.length!==suppliedHash.length)return null; let diff=0; for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^suppliedHash.charCodeAt(i); if(diff!==0)return null;
 try{const user=JSON.parse(params.get('user')||'{}');return user.id?String(user.id):null}catch(_){return null}
}
async function loadPlayer(db,id){const now=Math.floor(Date.now()/1000);await db.prepare('INSERT OR IGNORE INTO players (telegram_id) VALUES (?)').bind(id).run();let p=await db.prepare('SELECT * FROM players WHERE telegram_id=?').bind(id).first();const gained=Math.floor(Math.max(0,now-p.energy_updated_at)/300);if(gained>0){const energy=Math.min(25,p.energy+gained),updatedAt=energy===25?now:p.energy_updated_at+gained*300;await db.prepare('UPDATE players SET energy=?,energy_updated_at=?,updated_at=? WHERE telegram_id=?').bind(energy,updatedAt,now,id).run();p=await db.prepare('SELECT * FROM players WHERE telegram_id=?').bind(id).first()}return p}

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

    if (url.pathname === '/api/state') {
      if(!env.DB||!env.BOT_TOKEN)return Response.json({error:'Game storage is not configured'},{status:503});
      let initData=''; if(request.method==='GET')initData=url.searchParams.get('initData')||''; else if(request.method==='POST'){try{initData=(await request.json()).initData||''}catch(_){return Response.json({error:'Invalid JSON'},{status:400})}} else return new Response('Method Not Allowed',{status:405});
      const telegramId=await verifyTelegramInitData(initData,env.BOT_TOKEN); if(!telegramId)return Response.json({error:'Telegram authentication required'},{status:401});
      const p=await loadPlayer(env.DB,telegramId); return Response.json({ok:true,player:{telegramId:p.telegram_id,balance:p.balance,coins:p.coins,stars:p.stars,energy:p.energy,energyUpdatedAt:p.energy_updated_at,trialAt:p.trial_at,garage:JSON.parse(p.garage_json||'[]'),houseLevel:p.house_level,cars:JSON.parse(p.cars_json||'[]')}});
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
