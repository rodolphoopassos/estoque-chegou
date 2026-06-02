import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory';
import { History, ArrowUpRight, ArrowDownLeft, ShoppingCart, Trash2, Calendar, FileText, AlertTriangle, X } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

type CollectionSource = 'transacoes' | 'movimentacoes';

interface UnifiedLog {
  id: string;
  colecaoOrigem: CollectionSource;
  dataOriginal: string;
  operationLabel: 'IN' | 'OUT';
  description: string;
  impactoTotal: number;
  itemsPills: { name: string; quantity: number; unit: string; sign: string }[];
}

export default function Movements() {
  const { ingredients } = useInventory();
  
  const [transacoesData, setTransacoesData] = useState<any[]>([]);
  const [movimentacoesData, setMovimentacoesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [logToDelete, setLogToDelete] = useState<{ id: string; colecaoOrigem: CollectionSource } | null>(null);

  useEffect(() => {
    let transacoesLoaded = false;
    let movimentacoesLoaded = false;

    const checkLoading = () => {
      if (transacoesLoaded && movimentacoesLoaded) setLoading(false);
    };

    const unsubTransacoes = onSnapshot(collection(db, 'transacoes'), (snap) => {
      setTransacoesData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      transacoesLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transacoes'));

    const unsubMovimentacoes = onSnapshot(collection(db, 'movimentacoes'), (snap) => {
      setMovimentacoesData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      movimentacoesLoaded = true;
      checkLoading();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'movimentacoes'));

    return () => {
      unsubTransacoes();
      unsubMovimentacoes();
    };
  }, []);

  const logs = useMemo(() => {
    const combined: UnifiedLog[] = [];

    transacoesData.forEach(tx => {
      let opLabel: 'IN' | 'OUT' = 'OUT';
      if (tx.categoria === 'insumo' || tx.tipo === 'despesa') {
        opLabel = 'IN'; // Dinheiro sai mas insumo entra (Entrada no Estoque Financeiro) - pela regra do prompt
      }
      
      // By prompt rules: 
      // Se for uma compra de insumo, exibir 'IN'. 
      // Se for venda PDV ou registro do Preparo Diário, exibir 'OUT'.
      if (tx.categoria === 'insumo') opLabel = 'IN';
      else if (tx.categoria === 'venda') opLabel = 'OUT';

      combined.push({
        id: tx.id,
        colecaoOrigem: 'transacoes',
        dataOriginal: tx.data || new Date().toISOString(),
        operationLabel: opLabel,
        description: tx.descricao || 'Transação',
        impactoTotal: Number(tx.valor) || 0,
        itemsPills: [] // transações base não tem os arrays de detalhe de volume aqui nessa parte
      });
    });

    movimentacoesData.forEach(mov => {
      let opLabel: 'IN' | 'OUT' = 'OUT';
      if (mov.type === 'IN') opLabel = 'IN';
      
      const pills = (mov.items || []).map((i: any) => {
        const ing = ingredients.find(ing => ing.id === i.ingredientId);
        return {
          name: ing?.name || i.name || 'Item',
          quantity: i.quantity,
          unit: i.unit || '',
          sign: opLabel === 'IN' ? '+' : '-'
        };
      });

      combined.push({
        id: mov.id,
        colecaoOrigem: 'movimentacoes',
        dataOriginal: mov.date || new Date().toISOString(),
        operationLabel: opLabel,
        description: mov.description || 'Movimentação Lógica',
        impactoTotal: Number(mov.totalCost) || 0,
        itemsPills: pills
      });
    });

    return combined.sort((a, b) => new Date(b.dataOriginal).getTime() - new Date(a.dataOriginal).getTime());
  }, [transacoesData, movimentacoesData, ingredients]);

  const handleDeleteLog = async () => {
    if (logToDelete) {
      try {
        await deleteDoc(doc(db, logToDelete.colecaoOrigem, logToDelete.id));
        setLogToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, logToDelete.colecaoOrigem);
      }
    }
  };

  const handleExportAuditoria = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 uppercase italic">Contas a Receber</h2>
          <p className="text-slate-500 text-sm">Rastreabilidade de Transações Financeiras e Movimentações de Entrada.</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
          <Calendar size={16} className="text-slate-300" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronização Ativa</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead className="whitespace-nowrap">
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data/Hora</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operação</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Origem do Log</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Referência/Descrição</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Volumes/Itens</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Impacto Financ.</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right print:hidden">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center animate-pulse text-slate-400 font-medium italic underline decoration-indigo-200">Sincronizando auditoria de rede...</td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map(log => (
                  <tr key={`${log.colecaoOrigem}-${log.id}`} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 font-mono tracking-tighter italic">
                          {new Date(log.dataOriginal).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          {new Date(log.dataOriginal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm border",
                        log.operationLabel === 'IN' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        "bg-amber-50 text-amber-700 border-amber-100"
                      )}>
                        {log.operationLabel === 'IN' ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                        {log.operationLabel}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest bg-slate-100 px-2 py-1 rounded">
                         {log.colecaoOrigem}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700 leading-tight uppercase italic max-w-[250px] truncate" title={log.description}>{log.description}</p>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                        {log.itemsPills.map((pill, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200">
                            {pill.name}: {pill.sign}{pill.quantity}{pill.unit}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex flex-col items-end">
                        <span className={cn(
                          "font-mono font-black text-sm tracking-tighter",
                          log.impactoTotal === 0 ? "text-slate-400" :
                          log.operationLabel === 'IN' ? "text-emerald-600" : "text-amber-600" // Cor adaptada, pois despesa de insumo IN
                        )}>
                          {log.impactoTotal === 0 ? "R$ 0,00" : formatCurrency(log.impactoTotal)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right print:hidden">
                      <button 
                        onClick={() => setLogToDelete({ id: log.id, colecaoOrigem: log.colecaoOrigem })}
                        className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Remover Log (Irreversível)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 opacity-30">
                      <History size={24} className="text-slate-400" />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Nenhuma movimentação/transação registrada no período.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 text-white border border-slate-700 p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <FileText size={120} strokeWidth={1} />
        </div>
        <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
          <History className="text-indigo-300" size={32} />
        </div>
        <div className="flex-1 space-y-2 relative z-10">
          <h4 className="font-black text-xs uppercase tracking-[0.3em] text-indigo-300">Nota de Auditoria do Sistema</h4>
          <p className="text-indigo-100 text-sm leading-relaxed font-medium">
            Esta tela atua como uma Caixa-Preta (Log Irrefutável). As transações financeiras e as movimentações de estoque foram mescladas cronologicamente para garantir a rastreabilidade total de onde o dinheiro saiu e como o produto foi transformado.
          </p>
        </div>
        <button 
          onClick={handleExportAuditoria}
          className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-indigo-50 transition-all shrink-0 active:scale-95 z-10"
        >
          Exportar Auditoria
        </button>
      </div>

      {logToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500">
                Atenção: Você está deletando um log de <strong className="uppercase">{logToDelete.colecaoOrigem}</strong>. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setLogToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteLog}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow-sm transition-colors"
              >
                Excluir Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
