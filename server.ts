import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';

// Inicialize o Firebase Admin
if (!admin.apps.length) {
  // We need to provide projectId since ADC doesn't automatically know it here
  const rawConfig = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
  const config = JSON.parse(rawConfig);
  admin.initializeApp({
    projectId: config.projectId,
  });
  
  // Note: Since Firestore in Firebase console might be a named database,
  // we may need to specify the databaseId. If it's a named DB in this environment,
  // admin.firestore() currently connects to '(default)'.
}

// Configurações do seu inventário
const NOME_COLECAO_ESTOQUE = 'ingredients'; // In the frontend, it saves ingredients in 'ingredients'
const ID_DOCUMENTO_MASSA = 'massa_artesanal'; // O ID do documento da sua massa artesanal
const PESO_MASSA_POR_PIZZA = 350; // Gramas de massa por pizza (ajuste conforme sua receita)

// Função para disparo no WhatsApp - Evolution API
async function sendStockAlert(text: string, toPhone: string) {
  const instanceName = process.env.EVOLUTION_API_INSTANCE;
  const apikey = process.env.EVOLUTION_API_KEY;
  const baseUrl = process.env.EVOLUTION_API_URL;

  if (!instanceName || !apikey || !baseUrl) {
    console.warn("[Aviso] Variáveis de ambiente da Evolution API não encontradas no .env");
    console.warn("⚠️ O alerta seria disparado com o seguinte texto para", toPhone, ":\n", text);
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apikey
      },
      body: JSON.stringify({
        number: toPhone,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: text
        }
      })
    });

    if (response.ok) {
      console.log(`✅ Alerta de estoque enviado via WhatsApp para ${toPhone}`);
    } else {
      console.error(`❌ Erro ao enviar mensagem Evolution API: Status ${response.status}`);
      const textResponse = await response.text();
      console.error(textResponse);
    }
  } catch (err) {
    console.error("❌ Falha de rede ao tentar consumir a Evolution API:", err);
  }
}

// Tarefa de monitoramento de estoque cr\ítio
async function checkStockAndNotify() {
  console.log('[Cron] Verificando nível de estoque...');
  try {
    const rawConfig = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
    const config = JSON.parse(rawConfig);
    const dbUrl = config.firestoreDatabaseId;
    const firestoreDb = dbUrl ? getFirestore(admin.app(), dbUrl) : getFirestore(admin.app());

    // 1. Obter configs de notificação
    const settingsSnap = await firestoreDb.collection('settings').doc('notifications').get();
    const settings = settingsSnap.data();

    if (!settings || !settings.alertsEnabled || !settings.whatsappNumber) {
      console.log('[Cron] Alertas desabilitados ou número WhatsApp não configurado.');
      return;
    }

    // 2. Buscar itens abaixo do nível mínimo
    const estoqueRef = firestoreDb.collection(NOME_COLECAO_ESTOQUE);
    const snapshot = await estoqueRef.get();
    
    const itensCriticos: string[] = [];

    snapshot.forEach(doc => {
      const item = doc.data();
      const currentStock = Number(item.currentStock) || 0;
      const minStock = Number(item.minStock) || 0;
      const name = item.name || 'Item Desconhecido';
      const unit = item.unit || 'un';

      // Dispara se o atual for menor ou igual ao mínimo
      if (currentStock <= minStock) {
        itensCriticos.push(`• ${name}: ${currentStock}${unit} (Mínimo: ${minStock}${unit})`);
      }
    });

    // 3. Montar mensagem e acionar a API
    if (itensCriticos.length > 0) {
      const textoMensagem = `⚠️ *ALERTA DE ESTOQUE CRÍTICO - PizzariaControle* ⚠️\n\nOs seguintes itens estão acabando:\n${itensCriticos.join('\n')}\n\n💡 _Sugestão: Baseado no histórico de compras, acesse a Análise de Custos para verificar os menores preços antes de repor._`;
      
      await sendStockAlert(textoMensagem, settings.whatsappNumber);
    } else {
      console.log('[Cron] Estoque OK. Nenhum item crítico.');
    }
  } catch (error) {
    console.error('[Cron] Erro ao verificar estoque:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para parsear JSON (limite alto para receber imagens em base64)
  app.use(express.json({ limit: '50mb' }));

  // Rota de teste/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // ========== LEITURA DE NF-e VIA GEMINI AI ==========
  app.post('/api/ler-nfe', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(500).json({
          error: 'GEMINI_API_KEY não configurada no arquivo .env do servidor.'
        });
      }

      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      };

      const textPart = {
        text: 'Analise a imagem deste cupom fiscal ou nota fiscal. Extraia os itens comprados e retorne APENAS um objeto JSON válido no seguinte formato, sem formatação markdown: {"fornecedor": "Nome da Loja", "total": 150.00, "itens": [{"nome": "PRODUTO X", "quantidade": 2, "unidade": "UN", "precoUnitario": 10.50, "totalItem": 21.00}]} Se não conseguir ler algo, tente deduzir pelo contexto ou deixe o campo vazio, mas mantenha a estrutura JSON.',
      };

      console.log('[API] Processando imagem de NF-e via Gemini...');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fornecedor: { type: Type.STRING },
              total: { type: Type.NUMBER },
              itens: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nome: { type: Type.STRING },
                    quantidade: { type: Type.NUMBER },
                    unidade: { type: Type.STRING },
                    precoUnitario: { type: Type.NUMBER },
                    totalItem: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
      });

      const jsonText = response.text || '{}';
      const data = JSON.parse(jsonText);

      console.log(`[API] NF-e processada com sucesso: ${data.itens?.length || 0} itens extraídos de "${data.fornecedor || 'N/A'}"`);

      return res.json(data);
    } catch (error: any) {
      console.error('[API] Erro ao processar NF-e:', error);
      return res.status(500).json({
        error: error.message || 'Erro interno ao processar a nota fiscal.',
      });
    }
  });

  // ========== WEBHOOK BRENDI ==========
  app.post('/api/webhook/brendi', async (req, res) => {
    try {
      const pedido = req.body;

      // 1. Validação básica do Store UUID (conforme imagem)
      const storeUUID = "547a644b-5195-4d13-b010-49bfde240f83"; 
      if (pedido.merchantId !== storeUUID) {
        console.error("Tentativa de acesso de Merchant ID desconhecido:", pedido.merchantId);
        return res.status(403).send("Não autorizado");
      }

      // 2. Verifica se o pedido contém itens
      if (!pedido.items || !Array.isArray(pedido.items) || pedido.items.length === 0) {
        console.log("Pedido sem itens recebido.");
        return res.status(200).send("Pedido sem itens para processar.");
      }

      // Load firebase config to get dbId if needed
      const rawConfig = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(rawConfig);
      
      // Initialize Firestore reference using correct databaseId if applicable
      const dbUrl = config.firestoreDatabaseId;
      const firestoreDb = dbUrl ? getFirestore(admin.app(), dbUrl) : getFirestore(admin.app());

      let totalMassaParaAbater = 0;

      // 3. Calcula o total de massa artesanal a ser retirado e ignora bebidas
      pedido.items.forEach((item: any) => {
        const nomeItem = (item.name || "").toLowerCase();
        
        // Verifica se o item é uma pizza (ignora bebidas como 'refrigerante', 'coca', etc)
        const isPizza = nomeItem.includes('pizza') || (!nomeItem.includes('refrigerante') && !nomeItem.includes('coca') && !nomeItem.includes('guaraná') && !nomeItem.includes('suco') && !nomeItem.includes('água'));

        if (isPizza) {
          const qty = Number(item.quantity) || 1;
          totalMassaParaAbater += (PESO_MASSA_POR_PIZZA * qty);
        } else {
          console.log(`[Webhook] Item ignorado para a massa (bebida/outro): ${item.name}`);
        }
      });
      
      if (totalMassaParaAbater === 0) {
        return res.status(200).send("Nenhuma pizza encontrada para abater massa.");
      }

      // 4. Referência ao documento no Firestore
      // NOTE: No frontend desse app, o estoque é guardado em coleções locais. Precisamos nos certificar de usar o nome certo da coleção e ID da massa de acordo com o app.
      const massaRef = firestoreDb.collection(NOME_COLECAO_ESTOQUE).doc(ID_DOCUMENTO_MASSA);

      // 5. Executa a baixa de estoque de forma atômica
      try {
        await massaRef.update({
          // Adaptado para os campos do sistema 'Gourmet Inventory'
          currentStock: admin.firestore.FieldValue.increment(-totalMassaParaAbater),
          lastUpdated: admin.firestore.Timestamp.now().toDate().toISOString(),
          ultimo_pedido_id: pedido.id || 'N/A'
        });

        console.log(`Baixa de ${totalMassaParaAbater}g de massa realizada para o pedido ${pedido.id}`);
      } catch (dbError: any) {
        // Se o documento não existir, registramos um aviso e ignoramos para não haver loop de retentativas
        if (dbError.code === 5 || (dbError.message && dbError.message.includes('NOT_FOUND'))) {
          console.warn(`[Aviso] O documento de massa artesanal '${ID_DOCUMENTO_MASSA}' não existe. Ignorando atualização (Retornando 200).`);
          return res.status(200).send("Documento de massa não encontrado. Operação ignorada para evitar loop.");
        }
        throw dbError; // Passa adiante se for erro de permissão ou outro problema
      }
      
      // Retorna 200 para a Brendi confirmar o recebimento
      return res.status(200).send("Estoque atualizado com sucesso");

    } catch (error) {
      console.error("Erro ao processar estoque:", error);
      // Inclua um tratamento de erros para que... o sistema responda 200 OK para a Brendi (evitando loops de retentativa).
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
          console.error("Document reference not found, but returning 200 to prevent retries.");
          return res.status(200).send("Error: Document not found, but acknowledged.");
      }
      return res.status(500).send("Erro interno no servidor");
    }
  });

  // Vite middleware for development (after custom API routes)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API Webhook pronta em http://localhost:${PORT}/api/webhook/brendi`);
    
    // Inicia o Cron Job para rodar todo dia às 15:00
    cron.schedule('0 15 * * *', () => {
      checkStockAndNotify();
    });
    console.log('Cron Job de Estoque agendado para rodar às 15:00 diariamente.');
  });
}

startServer();
