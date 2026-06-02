import React, { useState, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory';
import { ChefHat, Plus, Pizza, Beer, Coffee, Trash2, Save, Info, TrendingUp, Edit2, X, Settings, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FichaTecnicaItem, CardapioItem, RecipeCategory } from '../types';

export default function Recipes() {
  const { ingredients, loading: inventoryLoading, recipeCategories, addRecipeCategory, updateRecipeCategory, deleteRecipeCategory } = useInventory();
  
  const [cardapio, setCardapio] = useState<CardapioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CardapioItem | null>(null);
  
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [ingredientesSelecionados, setIngredientesSelecionados] = useState<FichaTecnicaItem[]>([]);
  
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<RecipeCategory | null>(null);
  const [productToDelete, setProductToDelete] = useState<CardapioItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<RecipeCategory | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cardapio'), (snap) => {
      setCardapio(snap.docs.map(d => ({ id: d.id, ...d.data() } as CardapioItem)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const calculateProductCost = (recipe: FichaTecnicaItem[]) => {
    return recipe.reduce((acc, item) => {
      const ing = ingredients.find(i => i.id === item.insumoId);
      return acc + (Number(item.quantidade) * (Number(ing?.costPrice) || 0));
    }, 0);
  };

  const handleAddInsumoLinha = () => {
    setIngredientesSelecionados([...ingredientesSelecionados, { insumoId: '', nome_insumo: '', quantidade: 0 }]);
  };

  const handleChangeInsumo = (index: number, insumoId: string) => {
    const ing = ingredients.find(i => i.id === insumoId);
    if (!ing) return;
    
    const novos = [...ingredientesSelecionados];
    novos[index] = { ...novos[index], insumoId: ing.id!, nome_insumo: ing.name };
    setIngredientesSelecionados(novos);
  };

  const handleChangeQuantidade = (index: number, quantidade: number) => {
    const novos = [...ingredientesSelecionados];
    novos[index].quantidade = quantidade;
    setIngredientesSelecionados(novos);
  };

  const handleRemoveInsumo = (index: number) => {
    const novos = [...ingredientesSelecionados];
    novos.splice(index, 1);
    setIngredientesSelecionados(novos);
  };

  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim() || !categoria || !precoVenda) {
      setRecipeError("Preencha todos os campos básicos (Nome, Categoria, Preço).");
      return;
    }

    const fichaLimpa = ingredientesSelecionados.filter(i => i.insumoId && i.quantidade > 0);

    /* O usuário não é obrigado a adicionar ficha técnica caso seja só um produto de prateleira, 
       mas vamos validar se tentar adicionar algo invalido */
    if (ingredientesSelecionados.length > 0 && fichaLimpa.length !== ingredientesSelecionados.length) {
       setRecipeError("Alguns insumos da ficha técnica estão incompletos (Insumo não selecionado ou quantidade zero).");
       return;
    }

    setRecipeError(null);

    const productData = {
      nome: nome.trim(),
      categoria,
      preco_venda: Number(precoVenda),
      ficha_tecnica: fichaLimpa,
    };

    try {
      if (editingProduct && editingProduct.id) {
        await updateDoc(doc(db, 'cardapio', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'cardapio'), { ...productData, createdAt: new Date().toISOString() });
      }
      
      resetForm();
    } catch (err) {
      console.error(err);
      setRecipeError("Erro ao salvar o produto.");
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingProduct(null);
    setNome('');
    setCategoria('');
    setPrecoVenda('');
    setIngredientesSelecionados([]);
    setRecipeError(null);
  };

  const handleEditClick = (product: CardapioItem) => {
    setEditingProduct(product);
    setNome(product.nome);
    setCategoria(product.categoria);
    setPrecoVenda(String(product.preco_venda));
    setIngredientesSelecionados(product.ficha_tecnica || []);
    setRecipeError(null);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const productsWithCalculations = cardapio.map(product => {
     const cost = calculateProductCost(product.ficha_tecnica || []);
     const margin = product.preco_venda > 0 ? ((product.preco_venda - cost) / product.preco_venda) * 100 : 0;
     return { ...product, cost, margin };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Cardápio e Ficha Técnica</h2>
          <p className="text-slate-500 text-sm">Defina a composição proporcional de cada item vendido no PDV.</p>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold text-xs uppercase tracking-widest shadow-md shadow-indigo-100 transition-all"
        >
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      {isAdding && (
        <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-xl space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              {editingProduct ? <Edit2 size={22} className="text-amber-600" /> : <ChefHat size={22} className="text-indigo-600" />} 
              {editingProduct ? 'Editar Produto' : 'Novo Produto (Cardápio)'}
            </h3>
            <button 
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleSalvarProduto} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] flex items-center gap-2 border-b border-indigo-100 pb-2">
                1. DADOS DO PRODUTO (PDV)
              </h4>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome do Produto</label>
                <input value={nome} onChange={e => setNome(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700" placeholder="Ex: Pizza Calabresa Grande" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Categoria</label>
                  <button 
                    type="button" 
                    onClick={() => setShowCategoriesModal(true)}
                    className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1 uppercase tracking-wider"
                  >
                    <Settings size={12} /> Ajustar
                  </button>
                </div>
                <select value={categoria} onChange={e => setCategoria(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 appearance-none">
                  <option value="" disabled>Selecione uma categoria...</option>
                  {recipeCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                  {recipeCategories.length === 0 && (
                    <>
                      <option value="Pizzas">Pizzas</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Sobremesas">Sobremesas</option>
                      <option value="OUTROS">Outros</option>
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Preço de Venda ao Público (R$)</label>
                <div className="relative">
                   <span className="absolute left-4 top-2.5 text-indigo-400 font-bold">R$</span>
                   <input value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} type="number" step="0.01" required className="w-full bg-indigo-50/30 border border-indigo-100 rounded-lg pl-10 pr-4 py-2.5 text-lg font-mono font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20" placeholder="0.00" />
                </div>
              </div>

              {recipeError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-xs font-bold font-mono tracking-tighter shadow-sm animate-in fade-in slide-in-from-top-1">
                  {recipeError}
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                   2. FICHA TÉCNICA (INGREDIENTES)
                 </h4>
                 <button 
                   type="button"
                   onClick={handleAddInsumoLinha}
                   className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1 bg-indigo-100 px-2 py-1 rounded"
                 >
                   <Plus size={12} /> Adicionar Insumo
                 </button>
              </div>

              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                 {ingredientesSelecionados.map((item, idx) => (
                   <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm animate-in slide-in-from-left-2 duration-200">
                     <select 
                       value={item.insumoId} 
                       onChange={(e) => handleChangeInsumo(idx, e.target.value)}
                       className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700"
                     >
                       <option value="" disabled>Selecionar Insumo do Estoque...</option>
                       {ingredients.map(ing => (
                         <option key={ing.id} value={ing.id!}>{ing.name} ({ing.unit})</option>
                       ))}
                     </select>
                     
                     <div className="relative w-24">
                        <input 
                          type="number" 
                          step="0.001"
                          value={item.quantidade || ''}
                          onChange={(e) => handleChangeQuantidade(idx, parseFloat(e.target.value) || 0)}
                          placeholder="Qtd"
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono font-bold text-right pr-6"
                        />
                        {item.insumoId && (
                           <span className="absolute right-2 top-2 text-[8px] font-black uppercase text-slate-400">
                             {ingredients.find(i => i.id === item.insumoId)?.unit}
                           </span>
                        )}
                     </div>

                     <button 
                       type="button"
                       onClick={() => handleRemoveInsumo(idx)}
                       className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 ))}
                 
                 {ingredientesSelecionados.length === 0 && (
                   <div className="py-8 text-center border-2 border-dashed border-slate-200 mb-2 rounded-lg">
                     <p className="text-slate-400 text-xs font-medium italic">Nenhum insumo vinculado.<br/>Produto não deduzirá estoque ao ser vendido.</p>
                   </div>
                 )}
              </div>

               <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo de Produção Est.:</span>
                  <span className="font-mono font-black text-xl text-slate-800">{formatCurrency(calculateProductCost(ingredientesSelecionados))}</span>
               </div>

               <div className="pt-4">
                  <button type="submit" className={cn(
                  "w-full text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all border-b-4 active:border-b-0 active:translate-y-1",
                  editingProduct ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100 border-amber-700" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 border-indigo-800"
                  )}>
                    <Save size={18} /> {editingProduct ? 'Salvar Alterações' : 'Salvar Novo Produto'}
                  </button>
               </div>
            </div>
          </form>
        </div>
      )}

      {/* Product List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {(loading || inventoryLoading) ? (
          <div className="col-span-full py-20 text-center animate-pulse text-slate-400 font-medium">Sincronizando cardápio...</div>
        ) : productsWithCalculations.length > 0 ? (
          productsWithCalculations.map(product => {
            const { cost, margin } = product;
            
            // Calculate produceable quantity
            let maxProduceable = Infinity;
            let isCritical = false;
            let isWarning = false;

            if (!product.ficha_tecnica || product.ficha_tecnica.length === 0) {
              maxProduceable = 0; // If no recipe, we can't definitively say how much we can make relative to ingredients
            } else {
              product.ficha_tecnica.forEach(item => {
                const ing = ingredients.find(i => i.id === item.insumoId);
                if (!ing || item.quantidade <= 0) {
                  maxProduceable = 0;
                  isCritical = true;
                  return;
                }
                const possible = Math.floor(ing.currentStock / item.quantidade);
                if (possible < maxProduceable) maxProduceable = possible;
                
                if (ing.currentStock <= 0) isCritical = true;
                else if (ing.currentStock <= ing.minStock) isWarning = true;
              });
            }
            if (maxProduceable === Infinity) maxProduceable = 0;
            if (maxProduceable <= 0 && product.ficha_tecnica?.length > 0) isCritical = true;
            else if (maxProduceable <= 5 && product.ficha_tecnica?.length > 0) isWarning = true;

            return (
              <div key={product.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl transition-all group flex flex-col">
                <div className="p-6 bg-white border-b border-slate-50 flex justify-between items-start">
                  <div>
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest">{product.categoria}</span>
                    <h3 className="font-bold text-slate-800 text-xl mt-3 group-hover:text-indigo-600 transition-colors leading-tight">{product.nome}</h3>
                    
                    {product.ficha_tecnica && product.ficha_tecnica.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                          isCritical ? "bg-red-100 text-red-700" : isWarning ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          ESTOQUE LÓGICO: {maxProduceable} UN
                        </span>
                        {isCritical && (
                          <span className="text-red-500 flex items-center" title="Estoque esgotado para um ou mais componentes!">
                            <AlertTriangle size={14} className="animate-pulse" />
                          </span>
                        )}
                        {!isCritical && isWarning && (
                          <span className="text-amber-500 flex items-center" title="Componentes com estoque baixo!">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-black text-slate-900">{formatCurrency(product.preco_venda)}</p>
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Venda</span>
                  </div>
                </div>
                <div className="p-6 space-y-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Ficha Técnica Composição</div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-black text-indigo-600 leading-none">{formatCurrency(cost)}</p>
                      <p className="text-[9px] text-slate-300 uppercase font-bold mt-1 tracking-tighter">Custo Prep.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1 pr-1 custom-scrollbar overflow-y-auto max-h-[160px]">
                    {product.ficha_tecnica && product.ficha_tecnica.length > 0 ? (
                      product.ficha_tecnica.map((item, idx) => {
                        const ing = ingredients.find(i => i.id === item.insumoId);
                        return (
                          <div key={idx} className="flex justify-between text-xs py-1 text-slate-600 border-b border-slate-50 last:border-0 italic">
                            <span className="font-medium">{item.nome_insumo}</span>
                            <div className="flex items-center gap-4 text-right">
                              <span className="font-mono font-black text-slate-400 tracking-tighter">{item.quantidade}{ing?.unit || ''}</span>
                              <span className="font-mono font-black text-indigo-400 tracking-tighter min-w-[3.5rem]">{formatCurrency(item.quantidade * (Number(ing?.costPrice) || 0))}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                       <div className="text-xs text-slate-400 italic">Produto sem ficha técnica.</div>
                    )}
                  </div>
                  <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      margin > 40 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    )}>
                      <TrendingUp size={12} /> Lucro: {margin.toFixed(0)}%
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEditClick(product)}
                        className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
                        title="Ver Ficha / Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setProductToDelete(product)}
                        className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Remover Produto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full border-2 border-dashed border-slate-200 rounded-xl py-24 text-center">
             <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat size={32} className="text-slate-300" />
             </div>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum produto cadastrado no Cardápio</p>
          </div>
        )}
      </div>

      {/* Categories Modal */}
      {showCategoriesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Settings size={18} className="text-indigo-600" /> Ajuste de Categorias (PDV)
              </h3>
              <button onClick={() => setShowCategoriesModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCategoryName.trim()) return;
                  
                  if (editingCategory) {
                    await updateRecipeCategory(editingCategory.id!, newCategoryName.trim());
                    setEditingCategory(null);
                  } else {
                    await addRecipeCategory(newCategoryName.trim());
                  }
                  setNewCategoryName('');
                }}
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={editingCategory ? "Editar categoria..." : "Nova categoria..."}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                />
                <button type="submit" className={cn(
                  "px-4 py-2 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors",
                  editingCategory ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"
                )}>
                  {editingCategory ? "Salvar" : "Adicionar"}
                </button>
                {editingCategory && (
                  <button type="button" onClick={() => {
                    setEditingCategory(null);
                    setNewCategoryName('');
                  }} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">
                    <X size={16} />
                  </button>
                )}
              </form>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recipeCategories.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-4 italic">Nenhuma categoria customizada cadastrada.</p>
                ) : (
                  recipeCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="font-bold text-sm text-slate-700">{cat.name}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setNewCategoryName(cat.name);
                          }}
                          className="text-slate-400 hover:text-amber-500 transition-colors p-1"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => setCategoryToDelete(cat)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Delete Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Remover Produto</h3>
              <p className="text-sm text-slate-500">
                Tem certeza que deseja remover "{productToDelete.nome}"? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (productToDelete.id) {
                    await deleteDoc(doc(db, 'cardapio', productToDelete.id));
                    setProductToDelete(null);
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
