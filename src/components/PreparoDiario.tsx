import React, { useState, useEffect } from 'react';
import { ChefHat, Check, Beaker, Minus, Plus } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { doc, writeBatch, collection, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency } from '../lib/utils';

// Mock Recipe Data but we'll try to match by name with real ingredients
const massRecipe = {
  name: 'Lote de Massa Artesanal',
  yieldPerBatch: 7.5,
  yieldUnit: 'un',
  ingredients: [
    { name: 'Farinha de Trigo', nameTags: ['farinha', 'trigo'], quantityPerBatch: 2, unit: 'kg', trackInventory: true },
    { name: 'Água Gelada', nameTags: ['agua', 'água'], quantityPerBatch: 1.25, unit: 'L', trackInventory: false },
    { name: 'Sal', nameTags: ['sal', 'refinado'], quantityPerBatch: 0.04, unit: 'kg', trackInventory: true },
    { name: 'Açúcar', nameTags: ['açúcar', 'acucar'], quantityPerBatch: 0.015, unit: 'kg', trackInventory: true },
    { name: 'Fermento Biológico Seco', nameTags: ['fermento'], quantityPerBatch: 0.004, unit: 'kg', trackInventory: true },
    { name: 'Óleo ou Azeite', nameTags: ['oleo', 'óleo', 'soja', 'azeite'], quantityPerBatch: 0.1, unit: 'L', trackInventory: true }
  ],
  outputProductName: 'Massa Artesanal de Pizza (430g)'
};

export default function PreparoDiario() {
  const [quantidadeProduzida, setQuantidadeProduzida] = useState<number>(0);
  const [pesoMassa, setPesoMassa] = useState<number>(430);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customConsumptions, setCustomConsumptions] = useState<Record<string, number>>({});
  
  const { ingredients } = useInventory();

  // Encontra os ingredientes correspondentes na base real
  const mappedIngredients = React.useMemo(() => {
    return massRecipe.ingredients.map(recipeIng => {
      // Find matching ingredient in real DB based on name tags
      const realIng = ingredients.find(i => 
        recipeIng.nameTags.some(tag => i.name.toLowerCase().includes(tag))
      );
      
      const notFoundStr = recipeIng.trackInventory ? '(Não Encontrado no Estoque)' : '';
      const finalName = recipeIng.trackInventory 
        ? (realIng?.name || `${recipeIng.name} ${notFoundStr}`)
        : recipeIng.name;

      return {
        ...recipeIng,
        realId: recipeIng.trackInventory ? (realIng?.id || null) : null,
        realName: finalName,
        costPrice: realIng?.costPrice || 0
      };
    });
  }, [ingredients]);

  // Recalcular consumo automaticamente proporcional a 30un sempre que a quantidade mudar
  useEffect(() => {
    if (quantidadeProduzida <= 0) {
      setCustomConsumptions({});
      return;
    }
    
    const calculatedConsumptions: Record<string, number> = {};
    const proporcao = quantidadeProduzida / massRecipe.yieldPerBatch;
    
    mappedIngredients.forEach(ing => {
      calculatedConsumptions[ing.name] = parseFloat((ing.quantityPerBatch * proporcao).toFixed(3));
    });
    setCustomConsumptions(calculatedConsumptions);
  }, [quantidadeProduzida, mappedIngredients]);

  const handleConfirmarProducao = async () => {
    if (quantidadeProduzida <= 0) return;

    // Achar o produto "Massa Artesanal" no estoque
    const outputProduct = ingredients.find(i => i.name.toLowerCase().includes('massa artesanal'));
    
    if (!outputProduct) {
      alert("Erro: O item 'Massa Artesanal' não foi encontrado no estoque.\n\nPor favor, vá até a aba 'Estoque' e cadastre um insumo com o nome contendo 'Massa Artesanal' (Unidade de medida: un) para que o sistema possa registrar a entrada.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      let custoTotalDaProducao = 0;
      const consumedItems = [];

      // A: Baixa de Insumos (Estoque Geral)
      mappedIngredients.forEach(item => {
        if (!item.trackInventory) return;
        const totalConsumption = customConsumptions[item.name] || 0;
        if (totalConsumption > 0 && item.realId) {
          const ref = doc(db, 'produtos', item.realId);
          batch.update(ref, {
            currentStock: increment(-totalConsumption),
            lastUpdated: new Date().toISOString()
          });

          custoTotalDaProducao += (totalConsumption * item.costPrice);
          consumedItems.push({
            ingredientId: item.realId,
            name: item.realName,
            quantity: totalConsumption,
            unit: item.unit
          });
        }
      });

      // B: Entrada no Estoque da Massa Artesanal Produzida
      if (outputProduct.id) {
        batch.update(doc(db, 'produtos', outputProduct.id), {
          currentStock: increment(quantidadeProduzida),
          lastUpdated: new Date().toISOString()
        });
      }

      // C: Gerar Histórico na coleção de movimentacoes
      let descriptionStr = `Produção: Massa ${pesoMassa}g (${quantidadeProduzida} un)`;
      if (consumedItems.length > 0) {
        descriptionStr += ' - Usou: ' + consumedItems.map(c => `${c.quantity}${c.unit} ${c.name}`).join(', ');
      }

      const movementRef = doc(collection(db, 'movimentacoes'));
      batch.set(movementRef, {
        type: 'OUT',
        date: new Date().toISOString(),
        description: descriptionStr,
        items: consumedItems,
        totalCost: custoTotalDaProducao,
        category: 'produção',
        rendimento: quantidadeProduzida
      });

      await batch.commit(); 
      
      alert(`Produção de ${quantidadeProduzida} unidades de massa registrada com sucesso!`);
      setQuantidadeProduzida(0);
      setCustomConsumptions({});
    } catch (error) {
      console.error("Erro ao registrar produção:", error);
      alert("Houve um erro ao registrar a produção. Verifique a conexão com o banco.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 bg-slate-50 min-h-full p-2 sm:p-6 pb-24">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic flex items-center gap-2">
          <ChefHat className="text-indigo-600" size={24} />
          Preparo Diário
        </h2>
        <p className="text-slate-500 text-sm font-medium mt-1">
          Transformação de Insumos e Produção de Massa
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Receita (Esquerda) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Beaker size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm">
                Receita Padrão
              </h3>
              <p className="text-xs font-bold text-slate-400">
                {massRecipe.name}
              </p>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col">
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">Rendimento Padrão</p>
              <div className="flex items-center gap-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <ChefHat className="text-indigo-600" size={24} />
                <div>
                  <p className="text-slate-800 font-bold">1 Lote = {massRecipe.yieldPerBatch} {massRecipe.yieldUnit}</p>
                  <p className="text-xs text-indigo-600 font-medium">{massRecipe.outputProductName}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Insumos por Lote</p>
              <ul className="space-y-2">
                {mappedIngredients.map((ing, i) => (
                  <li key={i} className="flex flex-col p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className={`text-sm font-bold ${(ing.realId || !ing.trackInventory) ? 'text-slate-700' : 'text-rose-500'}`}>
                        {ing.realName}
                      </span>
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{ing.quantityPerBatch} {ing.unit}</span>
                    </div>
                    {(!ing.realId && ing.trackInventory) && (
                       <span className="text-[10px] font-bold text-rose-500 mt-1">
                         Atenção: Cadastre um insumo com nome contendo "{ing.nameTags[0]}" no Estoque para que ele seja deduzido.
                       </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Card de Execução (Direita) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
             <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm">
               Execução
             </h3>
          </div>
          
          <div className="p-6 flex-1 flex flex-col">
            {/* Rendimento da Masseira */}
            <div className="mb-8 p-6 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm">
              <label className="block text-xs font-black uppercase tracking-widest text-indigo-700 mb-4 text-center">
                O que foi produzido hoje?
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest pl-1">
                    Quantidade Produzida (un)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 20"
                    value={quantidadeProduzida || ''}
                    onChange={(e) => setQuantidadeProduzida(parseInt(e.target.value) || 0)}
                    className="w-full text-lg font-black text-indigo-700 bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Peso por Massa
                  </label>
                  <select
                    value={pesoMassa}
                    onChange={(e) => setPesoMassa(parseInt(e.target.value))}
                    className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  >
                    <option value={430}>430g - Pizza Padrão</option>
                    <option value={215}>215g - Pizza Brotinho</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Resumo do Consumo */}
            <div className="mb-8">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center justify-between">
                <span>Resumo do Consumo Dinâmico</span>
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumo</th>
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Consumo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappedIngredients.map((ing, i) => (
                      <tr key={i} className="bg-white">
                        <td className="p-3 text-sm font-bold text-slate-700 flex flex-col">
                          <span>{ing.realName}</span>
                          {(!ing.realId && ing.trackInventory) && (
                            <span className="text-[10px] text-rose-500">Sem vínculo no estoque</span>
                          )}
                        </td>
                        <td className="p-3 text-sm font-black text-rose-600 text-right flex justify-end items-center gap-1">
                          <span className="text-slate-400">-</span>
                          <input 
                            type="number"
                            step="0.01"
                            value={customConsumptions[ing.name] ?? ''}
                            onChange={(e) => setCustomConsumptions({...customConsumptions, [ing.name]: parseFloat(e.target.value) || 0})}
                            className={`w-24 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono ${!ing.trackInventory ? 'text-slate-400' : ''}`}
                            disabled={!ing.realId && ing.trackInventory}
                          />
                          <span className="text-slate-500 font-bold uppercase text-[10px] w-6">{ing.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-auto">
              <button
                onClick={handleConfirmarProducao}
                disabled={isSubmitting || (mappedIngredients.filter(ing => ing.trackInventory).every(ing => !ing.realId))}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 disabled:bg-slate-400 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Confirmando...</span>
                ) : (
                  <>
                    <Check size={20} />
                    Confirmar Produção e Baixar Estoque
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

