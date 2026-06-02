import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Smartphone, Save, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { cn, formatCurrency } from '../lib/utils';

export default function NotificationSettings() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [syncingLegacy, setSyncingLegacy] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!auth.currentUser) return;
      
      try {
        const settingsRef = doc(db, 'settings', 'notifications');
        const docSnap = await getDoc(settingsRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWhatsappNumber(data.whatsappNumber || '');
          setAlertsEnabled(data.alertsEnabled || false);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadSettings();
  }, []);

  const syncLegacyStockToFinance = async () => {
    try {
      setSyncingLegacy(true);
      const snapshot = await getDocs(collection(db, 'ingredients'));
      let totalCost = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.currentStock > 0 && data.costPrice > 0) {
          totalCost += (data.currentStock * data.costPrice);
        }
      });

      if (totalCost > 0) {
        await addDoc(collection(db, 'transacoes'), {
          type: 'out',
          category: 'mercadorias',
          description: 'Sincronização Inicial de Estoque Legado',
          amount: totalCost,
          date: new Date().toISOString()
        });
        alert('Sincronização concluída com sucesso! Valor lançado: ' + formatCurrency(totalCost));
      } else {
        alert('Não há saldo de estoque legado para sincronizar, ou ele já é de R$ 0,00.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao sincronizar estoque legado.');
    } finally {
      setSyncingLegacy(false);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    setSuccess(false);
    
    try {
      const settingsRef = doc(db, 'settings', 'notifications');
      await setDoc(settingsRef, {
        whatsappNumber,
        alertsEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 animate-pulse">Carregando configurações...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <SettingsIcon className="text-indigo-600" />
          Configurações de Notificação
        </h2>
        <p className="text-slate-500">Gerencie como você recebe alertas sobre o seu estoque e sistema.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          
          {/* Sincronização de Dados */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Database size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Manutenção de Banco de Dados</h3>
                <p className="text-sm text-slate-500">Ferramentas para correção de fluxo de dados no sistema.</p>
              </div>
            </div>

            <div className="grid gap-6 pt-2">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 text-sm">Sincronizar Estoque Legado com Financeiro</label>
                  <p className="text-xs text-slate-500 mt-0.5">Calcula o total de produtos no estoque em Reais e gera uma despesa no Financeiro com esse valor para nivelar o fluxo de caixa.</p>
                </div>
                <button
                  onClick={syncLegacyStockToFinance}
                  disabled={syncingLegacy}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  {syncingLegacy ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {syncingLegacy ? 'Sincronizando...' : 'Rodar Sincronização'}
                </button>
              </div>
            </div>
          </div>

          {/* Alertas via WhatsApp */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Alertas de Estoque Crítico</h3>
                <p className="text-sm text-slate-500">Receba notificações automáticas pelo WhatsApp</p>
              </div>
            </div>

            <div className="grid gap-6 pt-2">
              {/* Toggle Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-700 text-sm">Habilitar Auto-alertas</label>
                  <p className="text-xs text-slate-500 mt-0.5">O sistema verificará o estoque todos os dias às 15h.</p>
                </div>
                <button 
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2",
                    alertsEnabled ? "bg-indigo-600" : "bg-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      alertsEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Número do WhatsApp */}
              <div className={cn("space-y-3 transition-all duration-300", !alertsEnabled && "opacity-50 pointer-events-none")}>
                <label className="block text-sm font-bold text-slate-700">Número do WhatsApp Recebedor</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Smartphone size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow font-medium text-slate-900"
                  />
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  Inclua o código do país (55 para Brasil) e DDD. Use apenas números.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
          <div className="flex-1">
            {success && (
              <span className="text-emerald-600 text-sm font-bold flex items-center gap-1.5 animate-in fade-in duration-300">
                <CheckCircle2 size={16} /> Configurações salvas
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-70"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Save size={16} />
            )}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
