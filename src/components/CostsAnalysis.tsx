import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp, 
  Minus,
  Search,
  ShoppingCart,
  Calendar,
  Building2,
  Package,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

type PurchaseRecord = {
  id: string;
  date: string;
  supplier: string;
  quantity: number;
  unit: string;
  unitCost: number;
};

export default function CostsAnalysis() {
  const [insumos, setInsumos] = useState<{ id: string, name: string, unit: string, targetPrice?: number, costPrice?: number }[]>([]);
  const [insumoSelecionado, setInsumoSelecionado] = useState<string>('');
  const [allRecordsMap, setAllRecordsMap] = useState<Record<string, PurchaseRecord[]>>({});
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTargetPrice, setEditingTargetPrice] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState(false);

  // 1. Carregamento do Select (Insumos)
  useEffect(() => {
    const q = query(collection(db, 'produtos'), where('tipo', '==', 'insumo'));
    const unsub = onSnapshot(q, (snap) => {
      const loadedInsumos = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        unit: d.data().unit || 'un',
        targetPrice: d.data().targetPrice || 0,
        costPrice: d.data().costPrice || 0
      }));
      setInsumos(loadedInsumos);
      
      // Auto-select first item if possible and nothing is selected
      if (loadedInsumos.length > 0 && !insumoSelecionado) {
        setInsumoSelecionado(loadedInsumos[0].id);
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'produtos/insumos'));

    return () => unsub();
  }, [insumoSelecionado]);

  // 2. Carregamento do Cardápio / Fichas Técnicas
  useEffect(() => {
    const unsubCardapio = onSnapshot(collection(db, 'cardapio'), (snap) => {
      setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cardapio'));
    return () => unsubCardapio();
  }, []);

  // 3. Busca e Cálculos de Histórico de todos os insumos (O Motor do BI)
  useEffect(() => {
    if (insumos.length === 0) return;

    const qTransacoes = query(
      collection(db, 'transacoes'),
      where('categoria', '==', 'insumo')
    );
    
    const unsubTx = onSnapshot(qTransacoes, (snap) => {
      const recordsMap: Record<string, PurchaseRecord[]> = {};
      
      snap.docs.forEach(d => {
        const transacao = d.data();
        const arrayDeCompras = transacao.itens_comprados || transacao.itens || transacao.insumos || transacao.produtos;
        
        insumos.forEach(targetInsumo => {
          if (arrayDeCompras && Array.isArray(arrayDeCompras) && arrayDeCompras.length > 0) {
            const itemEspecifico = arrayDeCompras.find((i: any) => 
              i.ingredientId === targetInsumo.id || 
              i.id === targetInsumo.id || 
              i.insumoId === targetInsumo.id ||
              (i.name && i.name.trim().toLowerCase() === targetInsumo.name.trim().toLowerCase()) || 
              (i.nome && i.nome.trim().toLowerCase() === targetInsumo.name.trim().toLowerCase())
            );

            if (itemEspecifico) {
              const quantidadeDoItem = Number(itemEspecifico.quantity || itemEspecifico.quantidade) || 1;
              let custoUnitarioDoItem = 0;
              if (itemEspecifico.custo_unitario !== undefined) {
                custoUnitarioDoItem = Number(itemEspecifico.custo_unitario);
              } else if (itemEspecifico.unitCost !== undefined) {
                custoUnitarioDoItem = Number(itemEspecifico.unitCost);
              } else if (itemEspecifico.costPrice !== undefined) {
                custoUnitarioDoItem = Number(itemEspecifico.costPrice);
              } else if (itemEspecifico.valor_total !== undefined) {
                custoUnitarioDoItem = Number(itemEspecifico.valor_total) / quantidadeDoItem;
              } else if (itemEspecifico.valor !== undefined) {
                custoUnitarioDoItem = Number(itemEspecifico.valor) / quantidadeDoItem;
              }
              
              if (!recordsMap[targetInsumo.id]) {
                recordsMap[targetInsumo.id] = [];
              }
              recordsMap[targetInsumo.id].push({
                id: d.id + '_' + targetInsumo.id,
                date: transacao.data || new Date().toISOString(),
                supplier: itemEspecifico.supplier || itemEspecifico.fornecedor || transacao.fornecedor || 'Desconhecido',
                quantity: quantidadeDoItem,
                unit: itemEspecifico.unit || itemEspecifico.unidade || targetInsumo.unit || 'un',
                unitCost: custoUnitarioDoItem
              });
            }
          } 
          else if (transacao.descricao && transacao.descricao.toLowerCase().includes(targetInsumo.name.toLowerCase())) {
             const quantidadeDaTransacao = Number(transacao.quantidade) || 1;
             const totalDaTransacao = Number(transacao.valor) || 0;
             const custoUnitarioReal = totalDaTransacao / quantidadeDaTransacao;

             if (!recordsMap[targetInsumo.id]) {
               recordsMap[targetInsumo.id] = [];
             }
             recordsMap[targetInsumo.id].push({
               id: d.id,
               date: transacao.data || new Date().toISOString(),
               supplier: transacao.fornecedor || 'Desconhecido',
               quantity: quantidadeDaTransacao,
               unit: targetInsumo.unit || 'un',
               unitCost: custoUnitarioReal
             });
          }
        });
      });
      
      // Order chronologically for each key
      Object.keys(recordsMap).forEach(key => {
        recordsMap[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });
      
      setAllRecordsMap(recordsMap);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transacoes/analise'));

    return () => unsubTx();
  }, [insumos]);

  // Histórico específico do insumo selecionado
  const records = useMemo(() => {
    return allRecordsMap[insumoSelecionado] || [];
  }, [allRecordsMap, insumoSelecionado]);

  // Alertas de variação súbita de preço nas últimas compras (Top altas)
  const priceSpikes = useMemo(() => {
    const spikes: { insumoId: string, name: string, latestCost: number, previousCost: number, percentIncrease: number }[] = [];
    
    insumos.forEach(insumo => {
      const insumoRecords = allRecordsMap[insumo.id] || [];
      if (insumoRecords.length >= 2) {
        const latest = insumoRecords[insumoRecords.length - 1];
        const previous = insumoRecords[insumoRecords.length - 2];
        
        // Verifica se houve alta no custo unitário
        if (latest.unitCost > previous.unitCost) {
          const percentIncrease = ((latest.unitCost - previous.unitCost) / previous.unitCost) * 100;
          spikes.push({
            insumoId: insumo.id,
            name: insumo.name,
            latestCost: latest.unitCost,
            previousCost: previous.unitCost,
            percentIncrease
          });
        }
      }
    });

    return spikes.sort((a, b) => b.percentIncrease - a.percentIncrease).slice(0, 4);
  }, [allRecordsMap, insumos]);

  // Dados para o Gráfico
  const chartData = useMemo(() => {
    return records.map(r => ({
      date: new Date(r.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      custo: r.unitCost,
      supplier: r.supplier
    }));
  }, [records]);

  // Detalhes do insumo selecionado
  const selectedInsumoData = useMemo(() => {
    return insumos.find(i => i.id === insumoSelecionado);
  }, [insumos, insumoSelecionado]);

  // Atualizar input do preço alvo quando o insumo selecionado mudar
  useEffect(() => {
    if (selectedInsumoData) {
      setEditingTargetPrice(selectedInsumoData.targetPrice ? selectedInsumoData.targetPrice.toString() : '');
    }
  }, [insumoSelecionado, selectedInsumoData]);

  const handleSaveTargetPrice = async () => {
    if (!insumoSelecionado) return;
    setSavingPrice(true);
    try {
      const priceVal = parseFloat(editingTargetPrice);
      await updateDoc(doc(db, 'produtos', insumoSelecionado), {
        targetPrice: isNaN(priceVal) ? 0 : priceVal
      });
    } catch (e) {
      console.error("Erro ao salvar preço limite:", e);
    } finally {
      setSavingPrice(false);
    }
  };

  // Comparação por Fornecedor
  const supplierComparison = useMemo(() => {
    const supplierGroups: Record<string, PurchaseRecord[]> = {};
    records.forEach(r => {
      if (!supplierGroups[r.supplier]) {
        supplierGroups[r.supplier] = [];
      }
      supplierGroups[r.supplier].push(r);
    });

    return Object.entries(supplierGroups).map(([name, rList]) => {
      const sorted = [...rList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const lastPurchase = sorted[sorted.length - 1];
      const lowest = Math.min(...sorted.map(r => r.unitCost));
      
      return {
        name,
        lowestPrice: lowest,
        lastPrice: lastPurchase.unitCost,
        lastDate: lastPurchase.date
      };
    }).sort((a, b) => a.lowestPrice - b.lowestPrice);
  }, [records]);

  // Impacto na Ficha Técnica (Receitas)
  const recipesUsingInsumo = useMemo(() => {
    if (!insumoSelecionado) return [];
    
    return recipes.filter(p => 
      p.ficha_tecnica && Array.isArray(p.ficha_tecnica) && p.ficha_tecnica.some((item: any) => item.insumoId === insumoSelecionado)
    ).map(product => {
      const currentRecipeCost = product.ficha_tecnica.reduce((acc: number, item: any) => {
        const ing = insumos.find(i => i.id === item.insumoId);
        const ingCost = ing ? (ing.costPrice || 0) : 0;
        return acc + (Number(item.quantidade) * ingCost);
      }, 0);
      
      const ingredientQuantityUsed = Number(product.ficha_tecnica.find((item: any) => item.insumoId === insumoSelecionado)?.quantidade || 0);
      
      const currentMargin = product.preco_venda > 0 
        ? ((product.preco_venda - currentRecipeCost) / product.preco_venda) * 100 
        : 0;

      // Simulação: Se o preço deste insumo subir 20%
      const currentInsumoCost = selectedInsumoData?.costPrice || 0;
      const simulatedInsumoCost = currentInsumoCost * 1.2;
      
      const simulatedRecipeCost = product.ficha_tecnica.reduce((acc: number, item: any) => {
        const ing = insumos.find(i => i.id === item.insumoId);
        const ingCost = item.insumoId === insumoSelecionado 
          ? simulatedInsumoCost 
          : (ing ? (ing.costPrice || 0) : 0);
        return acc + (Number(item.quantidade) * ingCost);
      }, 0);
      
      const simulatedMargin = product.preco_venda > 0 
        ? ((product.preco_venda - simulatedRecipeCost) / product.preco_venda) * 100 
        : 0;

      return {
        id: product.id,
        nome: product.nome,
        preco_venda: product.preco_venda,
        quantityUsed: ingredientQuantityUsed,
        currentRecipeCost,
        currentMargin,
        simulatedMargin,
        costIncrease: simulatedRecipeCost - currentRecipeCost
      };
    });
  }, [recipes, insumos, insumoSelecionado, selectedInsumoData]);

  const currentPrice = records.length > 0 ? records[records.length - 1].unitCost : 0;
  const lowestPrice = records.length > 0 ? Math.min(...records.map(r => r.unitCost)) : 0;
  
  const monthsDiff = records.length > 1 
    ? (new Date(records[records.length - 1].date).getTime() - new Date(records[0].date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    : 1;
    
  const totalSpent = records.reduce((acc, r) => acc + (r.unitCost * r.quantity), 0);
  const avgMonthlySpend = monthsDiff > 0 ? totalSpent / Math.max(1, monthsDiff) : totalSpent;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-indigo-600" />
            Análise de Custos
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Histórico de preços e variação de insumos</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <select 
            value={insumoSelecionado}
            onChange={(e) => setInsumoSelecionado(e.target.value)}
            disabled={loading || insumos.length === 0}
            className="block w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700 appearance-none transition-colors cursor-pointer disabled:opacity-50"
          >
            <option value="" disabled>Selecione um insumo...</option>
            {insumos.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Alertas de Variações de Preço (Top Altas) */}
      {priceSpikes.length > 0 && (
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-rose-800">
            <AlertTriangle size={18} className="text-rose-600 animate-pulse" />
            <h4 className="text-xs font-black uppercase tracking-wider">Atenção: Insumos com maior alta de preço na última compra</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {priceSpikes.map(spike => (
              <button
                key={spike.insumoId}
                onClick={() => setInsumoSelecionado(spike.insumoId)}
                className="flex flex-col text-left p-4 bg-white border border-rose-100/70 rounded-xl shadow-xs transition-all hover:border-rose-300 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group"
              >
                <div className="text-xs font-black text-slate-700 truncate w-full group-hover:text-rose-600">{spike.name}</div>
                <div className="flex items-baseline justify-between w-full mt-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Variação</span>
                  <span className="text-sm font-black text-rose-600 flex items-center gap-0.5">
                    <TrendingUp size={14} />
                    {spike.percentIncrease.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-semibold mt-1">
                  De {formatCurrency(spike.previousCost)} para {formatCurrency(spike.latestCost)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!insumoSelecionado || records.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Sem registros</h3>
          <p className="text-slate-500 mt-2 text-sm">
            {insumos.length === 0 ? "Cadastre insumos para analisá-los." : "Não há histórico de compras para este insumo."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column (Chart + Table) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Chart Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
                Evolução do Custo Unitário
              </h3>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="99%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(value) => `R$${value}`}
                      tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      itemStyle={{ color: '#4f46e5' }}
                      formatter={(value: number) => [formatCurrency(value), 'Custo']}
                      labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="custo" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#4f46e5' }}
                      activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2, fill: '#fff' }}
                    />
                    {selectedInsumoData?.targetPrice && selectedInsumoData.targetPrice > 0 ? (
                      <ReferenceLine 
                        y={selectedInsumoData.targetPrice} 
                        stroke="#f43f5e" 
                        strokeDasharray="5 5" 
                        strokeWidth={2}
                        label={{ 
                          value: `Preço Limite: R$ ${selectedInsumoData.targetPrice.toFixed(2)}`, 
                          position: 'top', 
                          fill: '#f43f5e', 
                          fontSize: 10,
                          fontWeight: 'bold' 
                        }} 
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Histórico de Compras
                </h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[500px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <th className="py-3 px-6">Data</th>
                      <th className="py-3 px-6">Fornecedor</th>
                      <th className="py-3 px-6 text-right">Quantidade</th>
                      <th className="py-3 px-6 text-right">Custo Un.</th>
                      <th className="py-3 px-6 text-center">Variação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record, index) => {
                      // Variação em relação a compra anterior na ordem cronológica (records está ordenado)
                      const prevRecord = index > 0 ? records[index - 1] : null;
                      let DiffIcon = Minus;
                      let diffColor = "text-slate-400";
                      let diffBg = "bg-slate-100";
                      
                      if (prevRecord) {
                        if (record.unitCost < prevRecord.unitCost) {
                          DiffIcon = TrendingDown;
                          diffColor = "text-emerald-700";
                          diffBg = "bg-emerald-100";
                        } else if (record.unitCost > prevRecord.unitCost) {
                          DiffIcon = TrendingUp;
                          diffColor = "text-rose-700";
                          diffBg = "bg-rose-100";
                        }
                      }

                      return (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 text-sm font-bold text-slate-700">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-slate-400" />
                              {new Date(record.date).toLocaleDateString('pt-BR')}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-slate-400" />
                              <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{record.supplier}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-black text-slate-700">
                            {record.quantity} <span className="text-[10px] uppercase text-slate-400">{record.unit}</span>
                          </td>
                          <td className="py-4 px-6 text-right font-black text-slate-800">
                            {formatCurrency(record.unitCost)}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex justify-center">
                              {prevRecord ? (
                                <div className={cn("p-1.5 rounded-md", diffBg, diffColor)} title={`Anterior: ${formatCurrency(prevRecord.unitCost)}`}>
                                  <DiffIcon size={14} strokeWidth={3} />
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }).reverse()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Side Card - Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 inner-shadow shadow-indigo-100">
                <ShoppingCart size={32} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg uppercase">{insumos.find(i => i.id === insumoSelecionado)?.name || ''}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Resumo de Custo</p>
              
              <div className="w-full h-px bg-slate-100 my-6"></div>

              <div className="w-full space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex justify-between items-center transition-transform hover:-translate-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Menor Preço</span>
                  <span className="font-black text-lg text-emerald-700">{formatCurrency(lowestPrice)}</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center transition-transform hover:-translate-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Último Preço</span>
                  <span className="font-black text-lg text-slate-800">{formatCurrency(currentPrice)}</span>
                </div>
                
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center transition-transform hover:-translate-y-1">
                  <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Gasto Médio</div>
                    <div className="text-[9px] font-bold text-indigo-400 uppercase">Por Ciclo (Mês)</div>
                  </div>
                  <span className="font-black text-lg text-indigo-700">{formatCurrency(avgMonthlySpend)}</span>
                </div>
              </div>

              {/* Formulário para configurar preço limite */}
              <div className="w-full h-px bg-slate-100 my-6"></div>
              <div className="w-full text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-450 block mb-2">Configurar Preço Limite</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="Não definido"
                      value={editingTargetPrice}
                      onChange={(e) => setEditingTargetPrice(e.target.value)}
                      className="block w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700"
                    />
                  </div>
                  <button
                    onClick={handleSaveTargetPrice}
                    disabled={savingPrice}
                    className="px-3 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingPrice ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>

            </div>
            
            {/* Dica de Compra Card baseada em Preço Limite */}
            {(() => {
              const target = selectedInsumoData?.targetPrice || 0;
              const hasTarget = target > 0;
              const isOverTarget = hasTarget && currentPrice > target;
              
              let cardBg = "bg-gradient-to-br from-indigo-600 to-indigo-800 text-white";
              let textHeader = "text-indigo-100";
              let textBody = "text-indigo-200";
              let title = "Dica de Compra";
              let description = "Ótimo momento de compra! Você está pagando o menor valor histórico neste insumo.";
              
              if (hasTarget) {
                if (isOverTarget) {
                  cardBg = "bg-rose-50 border border-rose-200";
                  textHeader = "text-rose-800";
                  textBody = "text-rose-700";
                  title = "Dica de Compra: Limite Ultrapassado!";
                  description = `O preço atual (${formatCurrency(currentPrice)}) está acima do limite de ${formatCurrency(target)} que você definiu. Recomendamos adiar a compra ou negociar com o fornecedor.`;
                } else {
                  cardBg = "bg-emerald-50 border border-emerald-200";
                  textHeader = "text-emerald-800";
                  textBody = "text-emerald-700";
                  title = "Dica de Compra: Sob Controle";
                  description = `O preço atual (${formatCurrency(currentPrice)}) está sob controle, abaixo do seu limite definido de ${formatCurrency(target)}.`;
                }
              } else if (currentPrice > lowestPrice) {
                cardBg = "bg-amber-50 border border-amber-200";
                textHeader = "text-amber-800";
                textBody = "text-amber-700";
                title = "Dica de Compra: Negociar";
                description = "O preço atual está mais alto que o seu melhor histórico. Pode ser uma boa hora de tentar negociar ou buscar um fornecedor alternativo.";
              }
              
              return (
                <div className={cn("rounded-2xl shadow-sm p-6 text-center transition-colors", cardBg)}>
                  <h4 className={cn("font-black mb-2", textHeader)}>
                    {title}
                  </h4>
                  <p className={cn("text-xs font-semibold leading-relaxed", textBody)}>
                    {description}
                  </p>
                </div>
              );
            })()}

            {/* Comparador de Fornecedores */}
            {supplierComparison.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 text-left">
                  Comparador de Fornecedores
                </h3>
                <div className="space-y-3">
                  {supplierComparison.map(sup => (
                    <div key={sup.name} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-colors">
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-700 truncate max-w-[135px]" title={sup.name}>
                          {sup.name}
                        </div>
                        <div className="text-[9px] font-semibold text-slate-400">
                          Últ. Compra: {new Date(sup.lastDate).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-slate-800">
                          {formatCurrency(sup.lowestPrice)} <span className="text-[8px] font-black text-emerald-600 uppercase">Min</span>
                        </div>
                        <div className="text-[9px] font-bold text-slate-500">
                          Últ: {formatCurrency(sup.lastPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Impacto nas Receitas (Ficha Técnica) */}
            {recipesUsingInsumo.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Impacto nas Receitas (Ficha)
                  </h3>
                  <span className="bg-rose-50 text-[9px] font-black text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100 animate-pulse">
                    Simul. +20%
                  </span>
                </div>
                <div className="space-y-3">
                  {recipesUsingInsumo.map(recipe => (
                    <div key={recipe.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-black text-slate-700 truncate max-w-[145px] text-left">{recipe.nome}</span>
                        <span className="text-xs font-black text-slate-800">{formatCurrency(recipe.preco_venda)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 border-t border-slate-200/50 pt-1.5">
                        <span>Margem Atual: <strong className="text-slate-700">{recipe.currentMargin.toFixed(0)}%</strong></span>
                        <span className="flex items-center gap-0.5">
                          Simulada: 
                          <strong className={cn(
                            recipe.simulatedMargin < 50 ? "text-rose-600" : "text-amber-600",
                            "font-bold"
                          )}>
                            {recipe.simulatedMargin.toFixed(0)}%
                          </strong>
                        </span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 text-left">
                        Usa {recipe.quantityUsed} {selectedInsumoData?.unit || 'un'} por porção
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
