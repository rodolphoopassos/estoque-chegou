import React, { useState, useEffect } from 'react';
import { Send, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { cn } from "../lib/utils";

interface Props {
  onSaveConfig?: () => void;
}

export default function PainelComprasTelegram({ onSaveConfig }: Props) {
  const { ingredients } = useInventory();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    const load = async () => {
      const docSnap = await getDoc(doc(db, "configuracoes", "telegram"));
      if (docSnap.exists()) {
        setBotToken(docSnap.data().token_bot || '');
        setChatId(docSnap.data().chat_id || '');
      }
    };
    load();
  }, []);

  const handleSalvar = async () => {
    try {
      await setDoc(doc(db, "configuracoes", "telegram"), {
        token_bot: botToken,
        chat_id: chatId,
        atualizado_em: new Date()
      });
      alert("✅ Configurações salvas no Firebase!");
      if (onSaveConfig) onSaveConfig();
    } catch (e) { alert("Erro ao salvar."); }
  };

  const itensCriticos = ingredients.filter(i => Number(i.currentStock) <= Number(i.minStock));

  const handleDispararAlerta = async () => {
    if (!botToken || !chatId) {
      alert("⚠️ Você precisa salvar o Token e o Chat ID primeiro.");
      return;
    }

    if (itensCriticos.length === 0) {
      alert("📝 Não há itens em nível crítico/mínimo no momento.");
      return;
    }

    setIsLoading(true);
    let mensagem = `🚨 *ALERTA DE REPOSIÇÃO - CHEGOU PIZZA* 🚨\n\n`;
    mensagem += `Os seguintes insumos atingiram o estoque mínimo ou crítico e precisam ser comprados:\n\n`;
    
    itensCriticos.forEach(item => {
      mensagem += `• *${item.name}*\n`;
      mensagem += `  Estoque: ${item.currentStock} ${item.unit} | Min: ${item.minStock} ${item.unit}\n\n`;
    });

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensagem,
          parse_mode: 'Markdown'
        })
      });

      if (response.ok) {
        setIsSent(true);
        setTimeout(() => setIsSent(false), 3000);
      } else {
        alert("❌ Falha ao enviar o alerta. Verifique seu Token e Chat ID.");
      }
    } catch (e) {
      alert("❌ Erro de conexão com o Telegram.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="p-5 bg-slate-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Send className="text-blue-500" />
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Integração Telegram - Chegou Pizza</h3>
        </div>
      </div>
      
      <div className="p-5 space-y-6">
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex gap-3">
          <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800">
            <strong>Como configurar:</strong> Crie um bot no Telegram falando com o @BotFather, pegue o Token e insira abaixo. 
            Depois, adicione seu bot em um grupo e pegue o Chat ID.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Token do Bot</label>
            <input 
              placeholder="Ex: 8776980375:AAE2WS43..." 
              value={botToken} 
              onChange={e => setBotToken(e.target.value)}
              className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Chat ID</label>
            <input 
              placeholder="Ex: 5454402517 ou -1001234567" 
              value={chatId} 
              onChange={e => setChatId(e.target.value)}
              className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handleSalvar} 
            className="flex items-center gap-2 text-slate-600 bg-slate-100 px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-slate-200 transition-colors"
          >
            <Save size={16} /> Salvar Configurações
          </button>
        </div>
      </div>

      <div className="p-5 bg-slate-50 border-t space-y-4">
        <div>
          <h4 className="font-bold text-slate-800 text-sm mb-1">Status do Estoque</h4>
          <p className="text-xs text-slate-500">
            Você possui <strong>{itensCriticos.length}</strong> {itensCriticos.length === 1 ? 'insumo' : 'insumos'} abaixo do estoque mínimo.
          </p>
        </div>

        {itensCriticos.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-2">Nome do Insumo</th>
                  <th className="px-4 py-2 text-right">Qtd. Atual</th>
                  <th className="px-4 py-2 text-right">Mínimo</th>
                  <th className="px-4 py-2 text-right">Qtd. Sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itensCriticos.map(item => {
                  const current = Number(item.currentStock);
                  const min = Number(item.minStock);
                  const sugerida = Math.max(min - current, min > 0 ? 0 : 1);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-bold text-slate-700">{item.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600 font-bold">{current} {item.unit}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">{min} {item.unit}</td>
                      <td className="px-4 py-2 text-right font-mono text-indigo-600 font-bold">{sugerida || 'Definir'} {item.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center justify-center font-bold text-sm">
            ✅ Estoque OK! Nenhum insumo em estado crítico.
          </div>
        )}

        <button 
          onClick={handleDispararAlerta} 
          disabled={isLoading || isSent || itensCriticos.length === 0}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-2 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-md group overflow-hidden relative",
            isSent 
              ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200" 
              : "bg-blue-600 hover:bg-blue-700 shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
             <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : isSent ? (
             <CheckCircle2 size={16} className="animate-in zoom-in spin-in-12 duration-300" />
          ) : (
            <Send size={16} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /> 
          )}
           {isSent ? 'Mensagem Enviada!' : 'Disparar Alerta Manual'}
        </button>
      </div>
    </div>
  );
}