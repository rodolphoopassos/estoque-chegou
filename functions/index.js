const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// Inicializa o Firebase Admin SDK
admin.initializeApp();

// Configurações do Telegram
const TELEGRAM_BOT_TOKEN = "8776980375:AAE2WS43262egvNvGpMZx-2iimh-YRcgOGI";
const TELEGRAM_CHAT_ID = "5454402517";

/**
 * Função agendada para verificar itens críticos no estoque e enviar alerta via Telegram.
 * Roda todos os dias às 15:20 no horário de Brasília.
 */
exports.verificarestaoque = onSchedule(
  {
    schedule: "20 15 * * *", // Minuto 20, Hora 15, todos os dias
    timeZone: "America/Sao_Paulo", // Fuso horário de Brasília
  },
  async (event) => {
    try {
      // Fazendo a query na coleção 'produtos'
      const produtosSnapshot = await admin.firestore().collection("produtos").get();

      if (produtosSnapshot.empty) {
        console.log("Nenhum produto cadastrado.");
        return;
      }

      // Array para armazenar os itens que estão em estado crítico
      const itensCriticos = [];

      produtosSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convertendo para Number para garantir a comparação matemática correta
        // Nota: O front-end React está salvando como currentStock e minStock,
        // mas estou mantendo saldo_logico e estoque_minimo como solicitado. 
        // Adapte os nomes das chaves conforme o banco se necessário.
        const saldoLogico = Number(data.saldo_logico ?? data.currentStock ?? 0);
        const estoqueMinimo = Number(data.estoque_minimo ?? data.minStock ?? 0);

        if (saldoLogico <= estoqueMinimo) {
          itensCriticos.push({
            nome: data.nome || data.name || "Item sem nome",
            saldo: saldoLogico,
            unidade: data.unidade || data.unit || "un",
          });
        }
      });

      // Se não houver nenhum produto em nível crítico, encerra silenciosamente
      if (itensCriticos.length === 0) {
        console.log("Todos os insumos estão com estoque em níveis normais.");
        return;
      }

      // Monta a mensagem formatada para o Telegram em Markdown
      let mensagem = `🚨 *ALERTA DE ESTOQUE - CHEGOU PIZZA* 🚨\n`;
      mensagem += `Os seguintes insumos precisam de reposição:\n`;
      
      itensCriticos.forEach((item) => {
        mensagem += `- ${item.nome} (Restam: ${item.saldo}${item.unidade})\n`;
      });

      // Dados para o envio do POST
      const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: mensagem,
        parse_mode: "Markdown",
      };

      // Realiza a requisição nativa (fetch exigido em Node.js 18+)
      const response = await fetch(telegramApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Falha ao enviar mensagem pro Telegram:", err);
      } else {
        console.log("Alerta enviado com sucesso para o Telegram.");
      }
    } catch (error) {
      console.error("Erro interno na função verificarestaoque:", error);
    }
  }
);
