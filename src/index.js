
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

    if (url.pathname === '/api/action') {
      if (request.method !== 'POST' || !env.DB || !env.BOT_TOKEN) return Response.json({error:'Service unavailable'},{status:503});
      let body; try { body=await request.json(); } catch (_) { return Response.json({error:'Invalid JSON'},{status:400}); }
      const telegramId=await verifyTelegramInitData(body.initData,env.BOT_TOKEN);
      if(!telegramId) return Response.json({error:'Telegram authentication required'},{status:401});
      const p=await loadPlayer(env.DB,telegramId), now=Math.floor(Date.now()/1000), action=body.action; let actionNumbers=[];
      const save=async (sql,args)=>env.DB.prepare(sql).bind(...args).run();
      if(action==='trial'){
        if(now-p.trial_at<3600) return Response.json({error:'Trial energy cooldown',player:{energy:p.energy,trialAt:p.trial_at}},{status:429});
        const energy=Math.min(25,p.energy+10);
        const changed=await save('UPDATE players SET energy=?,trial_at=?,updated_at=? WHERE telegram_id=? AND trial_at<=?',[energy,now,now,telegramId,now-3600]); if(!changed.meta?.changes) return Response.json({error:'Trial energy cooldown'},{status:429});
      } else if(action==='spin'){
        const prices={any:2000000,unusual:4000000,rare:7000000,epic:19000000,legend:45000000,myth:100000000,secret:250000000};
        const weights={secret:[0,0,0,.08,.42,.35,.15],myth:[0,0,.03,.17,.35,.35,.10],legend:[.02,.08,.22,.35,.25,.075,.005],epic:[.08,.22,.35,.25,.08,.018,.002],rare:[.18,.37,.30,.12,.025,.004,.001],unusual:[.38,.42,.16,.035,.004,.0009,.0001],any:[.58,.27,.11,.032,.007,.0009,.0001]};
        const tiers=[['Обычный','common',35000],['Необычный','unusual',80000],['Редкий','rare',180000],['Эпический','epic',850000],['Легендарный','legend',4500000],['Мифический','myth',25000000],['Секретный','secret',100000000]];
        const type=prices[body.type]!==undefined?body.type:'any', count=Number(body.count||1);
        if(![1,3].includes(count)) return Response.json({error:'Invalid spin count'},{status:400});
        const cost=prices[type]*count;
        if(p.energy<count||p.balance<cost) return Response.json({error:'Недостаточно энергии или денег'},{status:409});
        const numbers=[];
        for(let n=0;n<count;n++){
          const w=weights[type], roll=Math.random(); let sum=0,index=0;
          for(let i=0;i<w.length;i++){sum+=w[i];if(roll<sum){index=i;break;}}
          const letters='АВЕКМНОРСТУХ', regions=['77','97','99','178','777','05','116','02','174','750'];
          const plate=letters[Math.floor(Math.random()*letters.length)]+Math.floor(Math.random()*10)+Math.floor(Math.random()*10)+Math.floor(Math.random()*10)+letters[Math.floor(Math.random()*letters.length)]+letters[Math.floor(Math.random()*letters.length)];
          const [rarity,cls,value]=tiers[index];
          numbers.push({plate,region:regions[Math.floor(Math.random()*regions.length)],rarity,cls,value});
        }
        actionNumbers=numbers; const garage=[...JSON.parse(p.garage_json||'[]'),...numbers].slice(-500);
        const result=await save('UPDATE players SET balance=balance-?,energy=energy-?,garage_json=?,updated_at=? WHERE telegram_id=? AND balance>=? AND energy>=?',[cost,count,JSON.stringify(garage),now,telegramId,cost,count]);
        if(!result.meta?.changes) return Response.json({error:'Недостаточно ресурсов'},{status:409});
      } else if(action==='upgradeHouse'){
        const costs=[500000,2500000,12000000,50000000,150000000], level=p.house_level;
        if(level>=5||p.balance<costs[level-1]) return Response.json({error:'Недостаточно денег или максимальный уровень'},{status:409});
        const changed=await save('UPDATE players SET balance=balance-?,house_level=house_level+1,updated_at=? WHERE telegram_id=? AND balance>=? AND house_level=?',[costs[level-1],now,telegramId,costs[level-1],level]); if(!changed.meta?.changes) return Response.json({error:'Недостаточно денег или дом уже улучшен'},{status:409});
      } else if(action==='buyCar'){
        const cars={'Городской седан':{cost:1200000,emoji:'🚗'},'Спорткар':{cost:12000000,emoji:'🏎️'},'Премиум внедорожник':{cost:35000000,emoji:'🚙'}};
        const car=cars[body.name]; if(!car||p.balance<car.cost) return Response.json({error:'Недостаточно денег или неизвестная машина'},{status:409});
        const owned=JSON.parse(p.cars_json||'[]');owned.push({name:body.name,emoji:car.emoji,cost:car.cost});
        await save('UPDATE players SET balance=balance-?,cars_json=?,updated_at=? WHERE telegram_id=? AND balance>=?',[car.cost,JSON.stringify(owned),now,telegramId,car.cost]);
      } else return Response.json({error:'Unknown action'},{status:400});
      const updated=await loadPlayer(env.DB,telegramId);
      return Response.json({ok:true,numbers:actionNumbers,player:{telegramId:updated.telegram_id,balance:updated.balance,coins:updated.coins,stars:updated.stars,energy:updated.energy,energyUpdatedAt:updated.energy_updated_at,trialAt:updated.trial_at,garage:JSON.parse(updated.garage_json||'[]'),houseLevel:updated.house_level,cars:JSON.parse(updated.cars_json||'[]')}});
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

      const senderId = message?.from?.id ? String(message.from.id) : "";
      const admins = (env.ADMIN_IDS || "").split(",").map(x => x.trim()).filter(Boolean);
      if (chatId && text.startsWith("/admin")) {
        if (admins.includes(senderId)) {
          await sendMessage(env.BOT_TOKEN, chatId, "🛡 Админ-доступ подтверждён. Панель тестовой игры активна.");
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, "⛔ У вас нет доступа к админ-панели.");
        }
      } else if (chatId && text.startsWith("/start")) {
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
