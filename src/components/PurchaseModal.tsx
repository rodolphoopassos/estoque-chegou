import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  ShoppingBag,
  PlusCircle,
  Check,
  AlertTriangle,
  Search,
  Filter,
  AlertCircle,
  Printer,
  FileText,
  Banknote,
  Landmark,
  CreditCard,
  Wallet
} from "lucide-react";
import { useInventory } from "../hooks/useInventory";
import { formatCurrency } from "../lib/utils";
import { Ingredient } from "../types";
import ChecklistModal from "./ChecklistModal";

interface PurchaseModalProps {
  onClose: () => void;
}

interface PurchaseItem {
  id: string;
  ingredientId: string;
  quantity: string;
  costPrice: string;
  expiryDate: string;
  extractedName?: string;
  isTotalEditing?: boolean;
  matchConfidence?: 'exact' | 'high' | 'medium' | 'none';
}

import LeitorNfe from "./LeitorNfe";
import { Camera } from "lucide-react";
import { useState as useStateReact } from "react";

export default function PurchaseModal({ onClose }: PurchaseModalProps) {
  const { ingredients, addStock, addIngredient, dicionarioInsumos } = useInventory();
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingIngredient, setIsCreatingIngredient] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showChecklist, setShowChecklist] = useState(false);
  const [paymentSource, setPaymentSource] = useState<'dinheiro' | 'banco' | 'cartao'>('dinheiro');
  const [showLeitorNfe, setShowLeitorNfe] = useState(false);
  const [mobilePane, setMobilePane] = useState<'alerts' | 'cart'>('cart');

  // ========== FUZZY MATCHING HELPERS ==========
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9\s]/g, ' ')   // remove especiais
      .replace(/\s+/g, ' ')
      .trim();
  };

  const calculateSimilarity = (nfeText: string, ingredientName: string): number => {
    const nfeNorm = normalizeText(nfeText);
    const ingNorm = normalizeText(ingredientName);

    // Exact match after normalization
    if (nfeNorm === ingNorm) return 1.0;

    // One contains the other
    if (nfeNorm.includes(ingNorm) || ingNorm.includes(nfeNorm)) return 0.85;

    // Word overlap scoring
    const nfeWords = nfeNorm.split(' ').filter(w => w.length > 1);
    const ingWords = ingNorm.split(' ').filter(w => w.length > 1);

    if (nfeWords.length === 0 || ingWords.length === 0) return 0;

    let matchCount = 0;
    for (const ingWord of ingWords) {
      for (const nfeWord of nfeWords) {
        // Exact word match or one starts with the other (handles abbreviations)
        if (nfeWord === ingWord || nfeWord.startsWith(ingWord) || ingWord.startsWith(nfeWord)) {
          matchCount++;
          break;
        }
      }
    }

    // Score based on how many ingredient words were found in the NF-e text
    return matchCount / ingWords.length;
  };

  const findBestMatch = (extractedName: string): { ingredientId: string; confidence: 'exact' | 'high' | 'medium' | 'none' } => {
    const nameNorm = normalizeText(extractedName);

    // 1. Dicionário — match exato
    const dictExact = dicionarioInsumos.find(d => d.nomeNota === extractedName);
    if (dictExact && ingredients.some(i => i.id === dictExact.idProdutoApp)) {
      return { ingredientId: dictExact.idProdutoApp, confidence: 'exact' };
    }

    // 2. Dicionário — match normalizado
    const dictNorm = dicionarioInsumos.find(d => normalizeText(d.nomeNota) === nameNorm);
    if (dictNorm && ingredients.some(i => i.id === dictNorm.idProdutoApp)) {
      return { ingredientId: dictNorm.idProdutoApp, confidence: 'exact' };
    }

    // 3. Fuzzy matching direto nos ingredientes cadastrados
    let bestScore = 0;
    let bestIngId = '';

    for (const ing of ingredients) {
      const score = calculateSimilarity(extractedName, ing.name);
      if (score > bestScore) {
        bestScore = score;
        bestIngId = ing.id!;
      }
    }

    if (bestScore >= 0.8) {
      return { ingredientId: bestIngId, confidence: 'high' };
    }
    if (bestScore >= 0.5) {
      return { ingredientId: bestIngId, confidence: 'medium' };
    }

    return { ingredientId: '', confidence: 'none' };
  };

  // ========== HANDLER DE LEITURA DA NF-e ==========
  const handleReadNfe = (data: any) => {
    setShowLeitorNfe(false);
    
    if (data.fornecedor) {
      setSupplier(data.fornecedor);
    }
    
    if (data.itens && Array.isArray(data.itens)) {
      const newItems = data.itens.map((extractedItem: any) => {
        const match = findBestMatch(extractedItem.nome);

        return {
          id: Math.random().toString(),
          ingredientId: match.ingredientId,
          extractedName: extractedItem.nome,
          quantity: extractedItem.quantidade?.toString() || "1",
          costPrice: extractedItem.precoUnitario?.toString() || "0",
          expiryDate: "",
          matchConfidence: match.confidence,
        };
      });

      // Contagem para log
      const autoLinked = newItems.filter((i: any) => i.ingredientId).length;
      const total = newItems.length;
      console.log(`[NF-e] ${autoLinked}/${total} itens vinculados automaticamente`);
      
      setItems(prev => [...prev, ...newItems]);
    }
  };

  const lowStockIngredients = useMemo(() => {
    return ingredients
      .filter((i) => i.currentStock <= i.minStock)
      .sort((a, b) => {
        const ratioA = a.minStock > 0 ? a.currentStock / a.minStock : 0;
        const ratioB = b.minStock > 0 ? b.currentStock / b.minStock : 0;
        return ratioA - ratioB;
      });
  }, [ingredients]);

  const filteredAlerts = useMemo(() => {
    return lowStockIngredients.filter(
      (i) => filterCategory === "all" || i.category === filterCategory,
    );
  }, [lowStockIngredients, filterCategory]);

  const handleAddFromAlert = (ing: Ingredient) => {
    const current = Math.max(0, ing.currentStock);
    const min = ing.minStock || 0;
    let suggested = Math.ceil(min * 2 - current);
    if (suggested <= 0) suggested = 1;

    setItems((prev) => {
      const existingIndex = prev.findIndex((p) => p.ingredientId === ing.id);
      if (existingIndex >= 0) return prev;

      return [
        ...prev,
        {
          id: Math.random().toString(),
          ingredientId: ing.id,
          quantity: suggested.toString(),
          costPrice: ing.costPrice.toString(),
          expiryDate: "",
        },
      ];
    });
  };

  const [quickCreateItem, setQuickCreateItem] = useState<{ itemId: string; suggestedName: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    category: "insumos",
    unit: "un",
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        ingredientId: "",
        quantity: "",
        costPrice: "",
        expiryDate: "",
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemChange = (
    id: string,
    field: keyof PurchaseItem,
    value: string,
  ) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );

    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) {
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === id
              ? { ...item, costPrice: ing.costPrice.toString() }
              : item,
          ),
        );
      }
    }
  };

  const openQuickCreateIngredient = (itemId: string, suggestedName: string) => {
    setQuickCreateItem({ itemId, suggestedName });
    let cleanedName = suggestedName || "";
    // Remove abbrevs just as an example or leave it mostly intact for the user to clean
    setNewIngredient({
      name: cleanedName,
      category: "insumos",
      unit: "un",
    });
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.costPrice) || 0;
      return total + qty * cost;
    }, 0);
  };

  const calculateLineTotal = (item: PurchaseItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const cost = parseFloat(item.costPrice) || 0;
    return qty * cost;
  };

  const handleSubmit = async () => {
    const isAllValid = items.every(
      (i) =>
        i.ingredientId &&
        parseFloat(i.quantity) > 0 &&
        parseFloat(i.costPrice) >= 0 &&
        i.expiryDate !== ""
    );

    if (!isAllValid || items.length === 0) {
      alert("Por favor, vincule todos os itens lidos aos insumos do sistema e preencha todos os campos corretamente.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addStock(
        items.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: parseFloat(i.quantity),
          costPrice: parseFloat(i.costPrice),
          expiryDate: i.expiryDate,
          extractedName: i.extractedName
        })),
        paymentSource,
      );
      onClose();
    } catch (error) {
      console.error("Erro ao registrar compra:", error);
      alert("Ocorreu um erro ao registrar a compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCreateItem) return;
    setIsCreatingIngredient(true);
    try {
      const newIngId = await addIngredient({
        name: newIngredient.name.trim(),
        unit: newIngredient.unit,
        category: newIngredient.category,
        costPrice: 0,
        currentStock: 0,
        minStock: 0,
        lastUpdated: new Date().toISOString(),
      });
      // Auto select it in the row
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === quickCreateItem.itemId
            ? { ...item, ingredientId: newIngId }
            : item,
        ),
      );
      setQuickCreateItem(null);
      setNewIngredient({
        name: "",
        category: "insumos",
        unit: "un",
      });
    } catch (error) {
      alert("Erro ao criar insumo");
    } finally {
      setIsCreatingIngredient(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-6xl overflow-hidden flex flex-col h-full sm:h-[95vh] animate-in fade-in zoom-in-95 duration-200 rounded-t-2xl sm:rounded-b-2xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-indigo-100 p-1.5 sm:p-2 rounded-lg text-indigo-600">
              <ShoppingBag size={18} />
            </div>
            <h2 className="text-base sm:text-xl font-black text-slate-800 uppercase tracking-tight">
              {isCreatingIngredient
                ? "Cadastrar Novo Insumo"
                : "Central de Reposição"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setMobilePane('alerts')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              mobilePane === 'alerts'
                ? 'text-amber-600 border-amber-500 bg-amber-50/50'
                : 'text-slate-400 border-transparent'
            }`}
          >
            <AlertTriangle size={14} /> Alertas
            {lowStockIngredients.length > 0 && (
              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1">
                {lowStockIngredients.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobilePane('cart')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              mobilePane === 'cart'
                ? 'text-indigo-600 border-indigo-500 bg-indigo-50/50'
                : 'text-slate-400 border-transparent'
            }`}
          >
            <ShoppingBag size={14} /> Carrinho
            {items.length > 0 && (
              <span className="bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1">
                {items.length}
              </span>
            )}
          </button>
        </div>

        {/* Split View for Reposição */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50">
          {/* Left Pane: Alertas de Estoque */}
          <div className={`w-full lg:w-[35%] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex-col lg:h-full lg:shrink-0 min-h-0 ${
            mobilePane === 'alerts' ? 'flex flex-1' : 'hidden lg:flex'
          }`}>
              <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <AlertTriangle size={16} className="text-amber-500" />{" "}
                    Estoque Crítico
                  </h3>
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                    {lowStockIngredients.length} Avisos
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Filter
                      size={14}
                      className="absolute left-3 top-2.5 text-slate-400"
                    />
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-600 font-medium appearance-none"
                    >
                      <option value="all">Todas Categorias</option>
                      <option value="gelados">Gelados/Bebidas</option>
                      <option value="vegetais">Vegetais/Hortifruti</option>
                      <option value="carnes">Carnes/Proteínas</option>
                      <option value="laticinios">Laticínios</option>
                      <option value="secos">Secos/Mercearia</option>
                      <option value="embalagens">Embalagens</option>
                      <option value="insumos">Outros</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-1 gap-3 content-start relative bg-slate-50/30">
                {filteredAlerts.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                      <Check size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                      Tudo em ordem!
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Nenhum estoque abaixo do nível mínimo nesta categoria.
                    </p>
                  </div>
                ) : (
                  filteredAlerts.map((ing) => {
                    const ratio =
                      ing.minStock > 0 ? ing.currentStock / ing.minStock : 0;
                    const isCritical = ing.currentStock <= 0 || ratio <= 0.25;
                    const isInCart = items.some(
                      (item) => item.ingredientId === ing.id,
                    );

                    const min = ing.minStock || 0;
                    let suggested = Math.ceil(
                      min * 2 - Math.max(0, ing.currentStock),
                    );
                    if (suggested <= 0) suggested = 1;

                    return (
                      <div
                        key={ing.id}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${isCritical ? "bg-red-500" : "bg-amber-400"}`}
                        ></div>

                        <div className="flex justify-between items-start mb-3 pl-2">
                          <div className="pr-2">
                            <h4 className="text-sm font-bold text-slate-800 leading-tight mb-0.5">
                              {ing.name}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                              {ing.category}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded bg-slate-100 flex items-center gap-1 ${isCritical ? "text-red-600 bg-red-50 border border-red-100" : "text-amber-600 bg-amber-50 border border-amber-100"}`}
                          >
                            {isCritical ? (
                              <AlertCircle size={10} />
                            ) : (
                              <AlertTriangle size={10} />
                            )}
                            {isCritical ? "Crítico" : "Baixo"}
                          </span>
                        </div>

                        <div className="pl-2 space-y-2 mb-4">
                          <div className="flex justify-between text-xs items-end">
                            <span className="text-slate-500 font-medium">
                              Estoque:
                            </span>
                            <span
                              className={`text-sm font-bold font-mono ${isCritical ? "text-red-600" : "text-amber-600"}`}
                            >
                              {ing.currentStock} {ing.unit}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${isCritical ? "bg-red-500" : "bg-amber-400"}`}
                              style={{
                                width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                              }}
                            ></div>
                          </div>
                          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] text-slate-400 font-medium">
                            <span title="Estoque mínimo configurado">
                              Meta(Mín): {ing.minStock} {ing.unit}
                            </span>
                            <span title="Último preço de custo">
                              Último Custo: {formatCurrency(ing.costPrice)}
                            </span>
                          </div>
                        </div>

                        <div className="pl-2">
                          <button
                            type="button"
                            onClick={() => handleAddFromAlert(ing)}
                            disabled={isInCart}
                            className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                              isInCart
                                ? "bg-slate-100 text-slate-400 border border-transparent shadow-none cursor-not-allowed"
                                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-100 shadow-sm"
                            }`}
                          >
                            {isInCart ? (
                              <>
                                <Check size={14} /> Na Lista
                              </>
                            ) : (
                              <>
                                <Plus size={14} /> Sugerir Compra ({suggested}{" "}
                                {ing.unit})
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Carrinho da Compra Atual */}
            <div className={`w-full lg:w-[65%] flex-col lg:h-full relative lg:shrink-0 min-h-0 ${
              mobilePane === 'cart' ? 'flex flex-1' : 'hidden lg:flex'
            }`}>
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {/* Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Data de Entrada
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Fornecedor (Opcional)
                    </label>
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Ex: Atacadão S.A."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Wallet size={12} className="text-indigo-500" /> Origem do Recurso
                    </label>
                    <div className="flex gap-1.5">
                      {([
                        { id: 'dinheiro' as const, label: 'Dinheiro', icon: <Banknote size={14} />, activeColor: 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-200' },
                        { id: 'banco' as const, label: 'Banco', icon: <Landmark size={14} />, activeColor: 'bg-blue-600 border-blue-700 text-white shadow-blue-200' },
                        { id: 'cartao' as const, label: 'Cartão', icon: <CreditCard size={14} />, activeColor: 'bg-purple-600 border-purple-700 text-white shadow-purple-200' },
                      ]).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentSource(opt.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                            paymentSource === opt.id
                              ? `${opt.activeColor} shadow-lg`
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {opt.icon}
                          <span className="hidden sm:inline">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-50 py-2 z-10 backdrop-blur-sm bg-slate-50/90">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
                      Solicitação de Compra
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLeitorNfe(true)}
                        className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-100"
                      >
                        <Camera size={14} /> Ler NFE (Foto)
                      </button>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-indigo-100"
                      >
                        <Plus size={14} /> Item Manual
                      </button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="bg-white border-2 border-slate-200 border-dashed rounded-xl p-10 text-center text-slate-400 flex flex-col items-center justify-center">
                      <div className="bg-slate-50 p-4 rounded-full mb-3">
                        <ShoppingBag size={32} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">
                        Nenhum item adicionado à lista.
                      </p>
                      <p className="text-xs font-medium mt-1">
                        Sugira a reposição pela lista ao lado ou inclua manualmente.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="mt-6 text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-lg uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                      >
                        Adicionar Primeiro Item
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => {
                        const selectedIng = ingredients.find(
                          (i) => i.id === item.ingredientId,
                        );
                        const unit = selectedIng?.unit || "un";

                        return (
                          <div
                            key={item.id}
                            className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] animate-in fade-in slide-in-from-bottom-2 relative"
                          >
                            {/* Botão remover */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="absolute right-2 top-2 text-slate-300 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors z-10"
                              title="Remover linha"
                            >
                              <Trash2 size={16} />
                            </button>

                            {/* Linha 1: Nome do produto lido pela IA */}
                            <div className="mb-3 pr-8">
                              {item.extractedName ? (
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                                    Produto (Lido pela IA)
                                  </label>
                                  <input
                                    type="text"
                                    value={item.extractedName}
                                    onChange={(e) =>
                                      handleItemChange(item.id, "extractedName", e.target.value)
                                    }
                                    className="w-full bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                                    Produto
                                  </label>
                                </div>
                              )}
                            </div>

                            {/* Linha 2: Vincular ao insumo do sistema */}
                            <div className="mb-3 pr-8">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                                  Vincular ao Insumo
                                </label>
                                {item.matchConfidence && item.matchConfidence !== 'none' && item.ingredientId && (
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    item.matchConfidence === 'exact'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : item.matchConfidence === 'high'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {item.matchConfidence === 'exact' ? '✓ Memória' : item.matchConfidence === 'high' ? '≈ Auto-vinculado' : '? Verificar'}
                                  </span>
                                )}
                                {item.extractedName && (!item.matchConfidence || item.matchConfidence === 'none') && !item.ingredientId && (
                                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                    ✗ Vincular manualmente
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                <select
                                  value={item.ingredientId}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      "ingredientId",
                                      e.target.value,
                                    )
                                  }
                                  className={`flex-1 bg-slate-50 border rounded-lg px-2.5 py-2 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors truncate ${
                                    item.ingredientId
                                      ? "border-emerald-300 text-slate-700 bg-emerald-50/50"
                                      : "border-red-200 text-slate-500 bg-red-50/30"
                                  }`}
                                >
                                  <option value="">⚠ Selecione o insumo correspondente...</option>
                                  {ingredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.unit})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => openQuickCreateIngredient(item.id, item.extractedName || '')}
                                  className="shrink-0 aspect-square h-[38px] w-[38px] flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100"
                                  title="Cadastrar Novo Insumo"
                                >
                                  <PlusCircle size={18} />
                                </button>
                              </div>
                            </div>

                            {/* Linha 3: Campos numéricos em grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                              {/* Quantidade */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                                  Qtd
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleItemChange(
                                        item.id,
                                        "quantity",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-right font-mono font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors pr-8"
                                  />
                                  <span className="absolute right-3 top-2.5 text-[10px] font-black text-slate-400 uppercase">
                                    {unit}
                                  </span>
                                </div>
                              </div>

                              {/* Custo Unitário */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                                  Custo UN
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.costPrice}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      "costPrice",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-mono text-right font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                                />
                              </div>

                              {/* Validade */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                                  Validade *
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={item.expiryDate}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.id,
                                      "expiryDate",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                                />
                              </div>

                              {/* Total Pago */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between pl-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Total
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleItemChange(item.id, "isTotalEditing", !item.isTotalEditing as any)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase transition-colors ${item.isTotalEditing ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    title={item.isTotalEditing ? "Bloquear Total" : "Ajustar Total Pago"}
                                  >
                                    {item.isTotalEditing ? "Fixar" : "Editar"}
                                  </button>
                                </div>
                                {item.isTotalEditing ? (
                                  <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={calculateLineTotal(item) || ''}
                                      onChange={(e) => {
                                        const total = parseFloat(e.target.value) || 0;
                                        const qty = parseFloat(item.quantity) || 1;
                                        handleItemChange(item.id, "costPrice", (total / qty).toFixed(4));
                                      }}
                                      className="w-full bg-slate-50 border border-indigo-200 rounded-lg pl-8 pr-2.5 py-2 text-sm font-mono text-right font-black text-indigo-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                                    />
                                  </div>
                                ) : (
                                  <div className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-mono text-right font-black text-slate-500 truncate opacity-90 cursor-not-allowed">
                                    {formatCurrency(calculateLineTotal(item))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-xs uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Adicionar linha manual
                    </button>
                  )}
                </div>
              </div>

              {/* Footer Panel do Carrinho */}
              <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 shrink-0 z-20 safe-area-bottom ${
                mobilePane !== 'cart' ? 'hidden lg:flex' : ''
              }`}>
                <div className="flex flex-col w-full sm:w-auto text-center sm:text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                    Valor Total Estimado
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-900 leading-none">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
                <div className="flex flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowChecklist(true)}
                    disabled={items.length === 0}
                    className="px-4 sm:px-6 py-3 text-indigo-700 font-bold text-[10px] sm:text-xs uppercase tracking-widest bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText size={16} /> Gerar Checklist
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || items.length === 0 || !items.every(i => i.ingredientId && parseFloat(i.quantity) > 0 && parseFloat(i.costPrice) >= 0 && i.expiryDate !== "")}
                    className="px-4 sm:px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-200 transition-all flex-1 sm:flex-none border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? (
                      "Salvando..."
                    ) : (
                      <>
                        <Check size={16} /> Confirmar e Lançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
      </div>

      {showChecklist && (
        <ChecklistModal
          items={items}
          ingredients={ingredients}
          onClose={() => setShowChecklist(false)}
        />
      )}
      
      {showLeitorNfe && (
        <LeitorNfe 
          onClose={() => setShowLeitorNfe(false)} 
          onRead={handleReadNfe} 
        />
      )}

      {quickCreateItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                Cadastrar Novo Insumo
              </h3>
              <button onClick={() => setQuickCreateItem(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form id="quickCreateIngredientForm" onSubmit={handleCreateIngredient} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Produto</label>
                  <input
                    required
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
                    placeholder="Ex: Uva Vitória"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categoria</label>
                    <select
                      value={newIngredient.category}
                      onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium appearance-none"
                    >
                      <option value="gelados">Gelados/Bebidas</option>
                      <option value="vegetais">Vegetais/Hortifruti</option>
                      <option value="carnes">Carnes/Proteínas</option>
                      <option value="laticinios">Laticínios</option>
                      <option value="secos">Secos/Mercearia</option>
                      <option value="embalagens">Embalagens</option>
                      <option value="insumos">Outros Insumos</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unidade de Medida</label>
                    <select
                      value={newIngredient.unit}
                      onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium appearance-none"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="kg">Quilograma (Kg)</option>
                      <option value="g">Grama (g)</option>
                      <option value="L">Litro (L)</option>
                      <option value="ml">Mililitro (ml)</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setQuickCreateItem(null)}
                className="px-4 py-2 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="quickCreateIngredientForm"
                disabled={isCreatingIngredient}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all flex items-center gap-2"
              >
                {isCreatingIngredient ? 'Salvando...' : 'Salvar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
