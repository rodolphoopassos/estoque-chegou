import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { AlertCircle, Clock, Trash2, ShieldAlert } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function ExpiryControlWidget() {
  const { ingredients, addWaste } = useInventory();
  
  const now = new Date();
  now.setHours(0,0,0,0);

  const getExpiryStatus = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Vencido', color: 'red', days: diffDays };
    if (diffDays === 0) return { label: 'Vence Hoje', color: 'red', days: 0 };
    if (diffDays <= 3) return { label: `Vence em ${diffDays}d`, color: 'orange', days: diffDays };
    if (diffDays <= 7) return { label: `Vence em ${diffDays}d`, color: 'yellow', days: diffDays };
    if (diffDays <= 15) return { label: `Vence em ${diffDays}d`, color: 'slate', days: diffDays };
    return null; // Not expiring soon
  };

  const expiringItems = ingredients
    .map(ing => ({ ...ing, status: getExpiryStatus(ing.expiryDate) }))
    .filter(ing => ing.status !== null)
    .sort((a, b) => (a.status?.days || 0) - (b.status?.days || 0));

  const handleWaste = (id: string, name: string, stock: number) => {
    const qty = window.prompt(`Registrar perda/descarte para ${name}.\nSaldo atual: ${stock}\n\nQuantidade a descartar:`, stock.toString());
    if (qty && !isNaN(Number(qty)) && Number(qty) > 0) {
      const reason = window.prompt(`Motivo do descarte:`, 'Vencido');
      addWaste(id, Number(qty), reason || 'Vencido');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Clock size={18} className="text-indigo-500" /> Controle de Validade
        </h3>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-black uppercase tracking-widest">
          {expiringItems.length} Alertas
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {expiringItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-medium text-sm flex flex-col items-center justify-center">
            <ShieldAlert size={32} className="mb-2 opacity-50" />
            Nenhum vencimento próximo (15 dias).
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {expiringItems.map(item => {
              const { color, label } = item.status!;
              const colorClasses: Record<string, string> = {
                red: "border-red-200 bg-red-50 text-red-800",
                orange: "border-orange-200 bg-orange-50 text-orange-800",
                yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
                slate: "border-slate-200 bg-slate-50 text-slate-800"
              };
              const badgeClasses: Record<string, string> = {
                red: "bg-red-500 text-white",
                orange: "bg-orange-500 text-white",
                yellow: "bg-yellow-400 text-yellow-900",
                slate: "bg-slate-200 text-slate-700"
              };

              return (
                <div key={item.id} className={cn("p-3 rounded-lg border flex items-center justify-between", colorClasses[color])}>
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      {item.name}
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest", badgeClasses[color])}>
                        {label}
                      </span>
                    </h4>
                    <p className="text-xs font-medium opacity-80 mt-1">
                      Estoque: {item.currentStock} {item.unit} • Data: {new Date(item.expiryDate!).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleWaste(item.id!, item.name, item.currentStock)}
                    className="p-2 bg-white/50 hover:bg-white rounded-lg transition-colors border shadow-sm text-slate-700 hover:text-red-600"
                    title="Registrar Perda"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
