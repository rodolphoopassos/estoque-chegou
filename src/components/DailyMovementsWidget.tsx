import React, { useMemo, useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { ArrowUpRight, ArrowDownRight, Package, ShoppingBag, Trash2, AlertTriangle } from 'lucide-react';
import { MovementType } from '../types';
import { formatCurrency } from '../lib/utils';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DailyMovementsWidget() {
  const { movements, ingredients, deleteMovement } = useInventory();
  const [movementToDelete, setMovementToDelete] = useState<string | null>(null);

  const dailyMovements = useMemo(() => {
    return movements
      .filter(m => isToday(new Date(m.date)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <ShoppingBag size={18} className="text-indigo-500" /> Movimentações de Hoje
        </h3>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-black uppercase tracking-widest">
          {dailyMovements.length} Registros
        </span>
      </div>
      
      <div className="p-0 overflow-y-auto max-h-[400px]">
        {dailyMovements.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Package size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma movimentação registrada hoje.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dailyMovements.map(mov => {
              const isIn = mov.type === MovementType.IN;
              const isSale = mov.type === MovementType.SALE;
              
              let Icon = isIn ? ArrowDownRight : ArrowUpRight;
              let iconColor = isIn ? "text-emerald-500 bg-emerald-100" : isSale ? "text-indigo-500 bg-indigo-100" : "text-amber-500 bg-amber-100";
              let typeLabel = isIn ? "Entrada" : isSale ? "Venda PDV" : "Saída";
              
              // Count total items
              const totalItems = mov.items.reduce((sum, i) => sum + i.quantity, 0);

              return (
                <div key={mov.id} className="p-4 hover:bg-slate-50 transition-colors group relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${iconColor}`}>
                        <Icon size={16} strokeWidth={3} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{typeLabel}</p>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                          {format(new Date(mov.date), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    {mov.totalCost !== undefined && (
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono ${isIn ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {isIn ? '+' : '-'}{formatCurrency(mov.totalCost)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pl-12">
                    <p className="text-xs text-slate-600 mb-1">{mov.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {mov.items.slice(0, 2).map((item, idx) => {
                        const ing = ingredients.find(i => i.id === item.ingredientId);
                        return (
                          <span key={idx} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            {item.quantity} {ing?.unit || 'un'} {ing?.name || 'Item'}
                          </span>
                        );
                      })}
                      {mov.items.length > 2 && (
                        <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          +{mov.items.length - 2} itens
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setMovementToDelete(mov.id!)}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 text-slate-400 p-1.5 rounded hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                    title="Excluir Movimentação"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {movementToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500">
                Tem certeza que deseja remover este registro? Esta ação irá reverter as alterações de estoque associadas a esta movimentação.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setMovementToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (movementToDelete) {
                    await deleteMovement(movementToDelete);
                    setMovementToDelete(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow-sm transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
