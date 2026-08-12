import { vincularPorToken, consultarContextoBot } from './telegram.service';

export interface TelegramUpdateRequest {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat?: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export async function processarWebhook(update: TelegramUpdateRequest): Promise<void> {
  if (!update.message || !update.message.text || !update.message.chat || !update.message.from) {
    return;
  }

  const text = update.message.text.trim();
  const chatId = update.message.chat.id.toString();
  const userId = update.message.from.id.toString();

  if (text.startsWith('/conectar')) {
    const parts = text.split(' ');
    if (parts.length > 1) {
      const token = parts[1];
      try {
        const { nome } = await vincularPorToken(token, chatId, userId);
        await enviarMensagem(chatId, `✅ Conta vinculada com sucesso, ${nome}! Você já pode enviar comandos ou recibos.`);
      } catch (error: any) {
        await enviarMensagem(chatId, `❌ Erro ao vincular: ${error.message}`);
      }
    } else {
      await enviarMensagem(chatId, `⚠️ Por favor, informe o token: /conectar <TOKEN>`);
    }
    return;
  }

  const contexto = await consultarContextoBot(userId, chatId);

  if (!contexto.vinculado) {
    await enviarMensagem(chatId, `👋 Olá! Sua conta não está vinculada ao Kofre.\n\nAcesse o aplicativo web, gere um token e envie: \`/conectar SEUTOKEN\``);
    return;
  }

  if (!contexto.sessaoAtiva) {
    await enviarMensagem(chatId, `🔒 Sua sessão expirou por segurança.\n\nPor favor, acesse o app Kofre e gere um novo token de conexão.`);
    return;
  }

  if (text === '/start') {
    await enviarMensagem(chatId, `Bem-vindo de volta, ${contexto.appUserNome || 'Usuário'}! O Kofre está pronto para receber seus gastos.\n\nExemplo: "Gastei 50 no mercado"`);
    return;
  }

  if (text === '/ajuda') {
    await enviarMensagem(chatId, `🤖 *Ajuda do Kofre Bot*\n\nVocê pode me enviar:\n- Textos com gastos: "25 reais na padaria"\n- Fotos de recibos ou cupons fiscais\n- Pedidos de saldo: "Quanto gastei esse mês?"`);
    return;
  }

  await enviarMensagem(chatId, `⏳ Mensagem recebida. Em breve a inteligência artificial do Kofre irá analisar e processar.`);
}

export async function enviarMensagem(chatId: string, texto: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN não configurado. Ignorando envio para chat:', chatId);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      console.error('Erro ao enviar mensagem Telegram:', await response.text());
    }
  } catch (error) {
    console.error('Erro de rede ao enviar mensagem:', error);
  }
}
