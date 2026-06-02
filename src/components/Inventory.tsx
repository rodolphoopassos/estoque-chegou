import React, { useState, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory';
import { Plus, Search, FileDown, Upload, Filter, Edit2, Trash2, X, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { Ingredient } from '../types';
import PurchaseModal from './PurchaseModal';

export default function Inventory() {
  const { ingredients, addIngredient, updateIngredient, deleteIngredient, addStock, loading } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Ingredient | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const InlineEditField = ({
    value,
    onSave,
    type = 'number',
    className,
    inputClassName,
    format
  }: {
    value: number;
    onSave: (val: number) => void;
    type?: string;
    className?: string;
    inputClassName?: string;
    format?: (val: number) => string | number;
  }) => {
    const [editing, setEditing] = useState(false);
    const [internalValue, setInternalValue] = useState(value?.toString() ?? '0');

    React.useEffect(() => {
      setInternalValue(value?.toString() ?? '0');
    }, [value]);

    if (editing) {
      return (
        <input
          autoFocus
          type={type}
          step="0.01"
          className={cn("w-28 text-right bg-white border border-indigo-300 rounded px-2 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500", inputClassName)}
          value={internalValue}
          onChange={(e) => setInternalValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const parsed = parseFloat(internalValue);
            if (!isNaN(parsed) && parsed !== value) {
              onSave(parsed);
            } else {
              setInternalValue(value?.toString() ?? '0');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              setInternalValue(value?.toString() ?? '0');
              setEditing(false);
            }
          }}
        />
      );
    }

    return (
      <div 
        className={cn("cursor-pointer hover:bg-amber-50 rounded px-2 py-1 -mx-2 transition-colors border-b border-transparent hover:border-amber-200 inline-flex min-w-[3rem] justify-end", className)}
        title="Clique para editar"
        onClick={() => setEditing(true)}
      >
        {format ? format(value) : value}
      </div>
    );
  };

  const filtered = ingredients.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      const expiry = i.expiryDate ? new Date(i.expiryDate) : null;
      let status = 'regular';
      if (expiry) {
        const isExpired = expiry < new Date();
        const isExpiringSoon = !isExpired && (expiry.getTime() - new Date().getTime()) < (3 * 24 * 60 * 60 * 1000);
        if (isExpired) status = 'expired';
        else if (isExpiringSoon) status = 'expiringSoon';
      }
      matchesStatus = statusFilter === status;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const groupedItems = filtered.reduce((acc, item) => {
    const cat = item.category || 'outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  const categoryNames: Record<string, string> = {
    gelados: "Gelados/Bebidas",
    laticinios: "Laticínios",
    frios: "Frios/Carnes",
    descartaveis: "Descartáveis",
    insumos: "Insumos/Massas",
    outros: "Outros"
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const expiryDate = formData.get('expiryDate') as string;
    
    if (editingItem) {
      const updates: any = {
        name: formData.get('name') as string,
        unit: formData.get('unit') as string,
        currentStock: Number(formData.get('currentStock')),
        minStock: Number(formData.get('minStock')),
        costPrice: Number(formData.get('costPrice')),
        category: formData.get('category') as string,
        expiryDate: expiryDate || null,
      };
      await updateIngredient(editingItem.id!, updates);
      setEditingItem(null);
    } else {
      const newItem: any = {
        name: formData.get('name') as string,
        unit: formData.get('unit') as string,
        currentStock: Number(formData.get('currentStock')),
        minStock: Number(formData.get('minStock')),
        costPrice: Number(formData.get('costPrice')),
        category: formData.get('category') as string,
        expiryDate: expiryDate || null,
        lastUpdated: new Date().toISOString()
      };
      
      const autoLink = formData.get('autoLink') === 'on';
      await (addIngredient as any)(newItem, autoLink);
      setIsAdding(false);
    }
  };

  const handleDelete = (item: Ingredient) => {
    setItemToDelete(item);
  };

  const handleEditClick = (item: Ingredient) => {
    setIsAdding(false);
    setEditingItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">Catálogo de Insumos</h2>
          <p className="text-slate-500 text-xs sm:text-sm">Gestão de matérias-primas e saldo de estoque proporcional.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setIsPurchasing(true)}
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-md shadow-indigo-100 flex-1 sm:flex-none justify-center sm:justify-start"
          >
            <Plus size={16} /> Lançar Compras
          </button>
          <button 
            onClick={() => {
              setIsAdding(!isAdding);
              setEditingItem(null);
            }}
            className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors font-bold text-[10px] sm:text-xs uppercase tracking-widest"
          >
            <Plus size={16} /> Novo
          </button>
          <button className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors font-bold text-[10px] sm:text-xs uppercase tracking-widest hidden sm:flex">
            <Upload size={16} /> Importar XML
          </button>
        </div>
      </div>

      {isPurchasing && (
        <PurchaseModal onClose={() => setIsPurchasing(false)} />
      )}

      {(isAdding || editingItem) && (
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-start mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              {editingItem ? <Edit2 size={20} className="text-amber-600" /> : <Plus size={20} className="text-indigo-600" />} 
              {editingItem ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}
            </h3>
            <button 
              onClick={() => {
                setIsAdding(false);
                setEditingItem(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome do Insumo</label>
              <input name="name" defaultValue={editingItem?.name} required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium" placeholder="Ex: Guaraná 1 Litro" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Categoria</label>
              <select name="category" defaultValue={editingItem?.category || 'insumos'} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium appearance-none">
                <option value="gelados">Gelados/Bebidas</option>
                <option value="laticinios">Laticínios</option>
                <option value="frios">Frios/Carnes</option>
                <option value="descartaveis">Descartáveis</option>
                <option value="insumos">Insumos/Massas</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Unidade Medida</label>
              <select name="unit" defaultValue={editingItem?.unit || 'kg'} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium appearance-none">
                <option value="kg">kg (Quilograma)</option>
                <option value="un">un (Unidade)</option>
                <option value="l">l (Litro)</option>
                <option value="ml">ml (Mililitro)</option>
                <option value="g">g (Grama)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estoque Atual</label>
              <input name="currentStock" defaultValue={editingItem ? editingItem.currentStock : 0} type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono font-bold" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nível Mínimo</label>
              <input name="minStock" defaultValue={editingItem ? editingItem.minStock : 0} type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono" placeholder="10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Custo Unitário (R$)</label>
              <input name="costPrice" defaultValue={editingItem ? editingItem.costPrice : 0} type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-amber-600">Data de Validade</label>
              <input name="expiryDate" defaultValue={editingItem?.expiryDate} type="date" className="w-full bg-amber-50/50 border border-amber-100 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
            </div>

            {!editingItem && (
              <div className="md:col-span-2 lg:col-span-3 flex items-center gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <input type="checkbox" id="autoLink" name="autoLink" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                <label htmlFor="autoLink" className="text-xs font-bold text-indigo-800 uppercase tracking-tighter">Vincular automaticamente ao PDV (Criar Produto p/ Venda)</label>
              </div>
            )}

            <div className={cn("lg:col-span-1 lg:pt-0 flex items-end", editingItem ? "lg:col-start-4" : "")}>
              <button type="submit" className={cn(
                "w-full text-white py-3 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all border-b-4 active:border-b-0 active:translate-y-1",
                editingItem 
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100 border-amber-700" 
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 border-indigo-800"
              )}>
                {editingItem ? 'Salvar Alterações' : 'Gravar Insumo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 text-sm focus:outline-none font-medium text-slate-600" 
            placeholder="Pesquisar insumo..." 
          />
        </div>
        <div className="w-px h-6 bg-slate-100 hidden md:block"></div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none flex-1 sm:flex-none sm:min-w-[140px]"
          >
            <option value="all">Validade</option>
            <option value="expired">Vencidos</option>
            <option value="expiringSoon">Próximos</option>
            <option value="regular">Regulares</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none flex-1 sm:flex-none sm:min-w-[140px]"
          >
            <option value="all">Categorias</option>
            <option value="gelados">Gelados/Bebidas</option>
            <option value="laticinios">Laticínios</option>
            <option value="frios">Frios/Carnes</option>
            <option value="descartaveis">Descartáveis</option>
            <option value="insumos">Insumos/Massas</option>
            <option value="outros">Outros</option>
          </select>
        </div>
      </div>

      {/* Desktop Table + Mobile Cards */}
      {/* Desktop: Table view */}
      <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] whitespace-nowrap font-black text-slate-400 uppercase tracking-[0.1em]">
              <tr>
                <th className="px-6 py-4">Insumo / Categoria</th>
                <th className="px-6 py-4">Validade</th>
                <th className="px-6 py-4">U.M.</th>
                <th className="px-6 py-4 text-right">Custo Médio</th>
                <th className="px-6 py-4 text-right">Saldo Logico</th>
                <th className="px-6 py-4 text-right">Custo Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center text-slate-400 animate-pulse font-medium">Sincronizando banco de dados...</td>
                </tr>
              ) : filtered.length > 0 ? (
                Object.entries(groupedItems).map(([category, items]) => {
                  const isExpanded = expandedCategories[category] !== false;
                  return (
                    <React.Fragment key={category}>
                      <tr 
                        className="bg-slate-50/80 cursor-pointer hover:bg-slate-100/80 transition-colors"
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                      >
                        <td colSpan={8} className="px-8 py-3 border-y border-slate-100">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                            <span className="font-bold text-slate-700 uppercase tracking-wider text-xs">
                              {categoryNames[category] || category}
                            </span>
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {items.length} {items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && items.map(item => {
                        const isLow = item.currentStock <= item.minStock;
                        const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
                        const isExpired = expiry && expiry < new Date();
                        const isExpiringSoon = expiry && (expiry.getTime() - new Date().getTime()) < (3 * 24 * 60 * 60 * 1000);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-slate-400 font-medium">Atu: {new Date(item.lastUpdated || Date.now()).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {item.expiryDate ? (
                                <div className={cn("flex flex-col", isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-slate-600")}>
                                  <span className="text-[10px] font-black uppercase italic tracking-tighter">
                                    {new Date(item.expiryDate).toLocaleDateString()}
                                  </span>
                                  <span className="text-[9px] font-bold">
                                    {isExpired ? 'VENCIDO' : isExpiringSoon ? 'PROX. VENCIMENTO' : 'REGULAR'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Não espec.</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">{item.unit}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">
                              <InlineEditField 
                                value={item.costPrice} 
                                onSave={(val) => updateIngredient(item.id!, { costPrice: val })}
                                format={formatCurrency}
                                className="w-full"
                              />
                            </td>
                            <td className={cn("px-6 py-4 text-right font-mono font-black text-lg", isLow ? "text-amber-600" : "text-indigo-600")}>
                              <InlineEditField 
                                value={item.currentStock} 
                                onSave={(val) => updateIngredient(item.id!, { currentStock: val })}
                                format={(v) => item.unit === 'un' ? v.toFixed(0).padStart(2, '0') : v.toFixed(2).replace('.', ',')}
                                className="w-full"
                              />
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-500">
                              {formatCurrency(item.costPrice * item.currentStock)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                              )}>
                                {isLow ? 'CRÍTICO' : 'NORMAL'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEditClick(item)}
                                  className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(item)}
                                  className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center text-slate-400 italic font-medium">Nenhum insumo encontrado nesta categoria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 animate-pulse font-medium">
            Sincronizando banco de dados...
          </div>
        ) : filtered.length > 0 ? (
          Object.entries(groupedItems).map(([category, items]) => {
            const isExpanded = expandedCategories[category] !== false;
            return (
              <div key={category}>
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-100 rounded-lg mb-2 active:bg-slate-200 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-xs flex-1 text-left">
                    {categoryNames[category] || category}
                  </span>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {items.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-2 gap-2 content-start">
                    {items.map(item => {
                      const isLow = item.currentStock <= item.minStock;
                      const expiry = item.expiryDate ? new Date(item.expiryDate) : null;
                      const isExpired = expiry && expiry < new Date();
                      const isExpiringSoon = expiry && (expiry.getTime() - new Date().getTime()) < (3 * 24 * 60 * 60 * 1000);

                      return (
                        <div key={item.id} className={cn(
                          "bg-white border rounded-xl p-3 shadow-sm relative overflow-hidden flex flex-col justify-between",
                          isLow ? "border-amber-200" : "border-slate-200"
                        )}>
                          {/* Colored left bar */}
                          <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
                            isLow ? "bg-amber-400" : "bg-emerald-400"
                          )} />

                          <div>
                            {/* Top row: Name + Status */}
                            <div className="flex flex-wrap justify-between items-start gap-1 mb-2 pl-2">
                              <div className="flex-1 min-w-0 pr-1">
                                <h4 className="font-bold text-slate-800 text-xs sm:text-sm leading-tight truncate" title={item.name}>{item.name}</h4>
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                  <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-wider uppercase">{item.unit}</span>
                                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium">Atu: {new Date(item.lastUpdated || Date.now()).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <span className={cn(
                                "shrink-0 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-wider",
                                isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                              )}>
                                {isLow ? 'CRÍTICO' : 'OK'}
                              </span>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-1 pl-2 mb-3 text-left">
                              <div>
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase block">Estoque</span>
                                <span className={cn("text-xs sm:text-sm font-black font-mono", isLow ? "text-amber-600" : "text-indigo-600")}>
                                  {item.unit === 'un' ? item.currentStock.toFixed(0).padStart(2, '0') : item.currentStock.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase block">Mínimo</span>
                                <span className="text-xs sm:text-xs font-bold font-mono text-slate-500">
                                  {item.unit === 'un' ? item.minStock.toFixed(0) : item.minStock.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase block">Custo</span>
                                <span className="text-xs sm:text-xs font-bold font-mono text-slate-600 truncate block" title={formatCurrency(item.costPrice)}>
                                  {formatCurrency(item.costPrice)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expiry + Actions row */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pl-2 pt-2 border-t border-slate-50">
                            <div className="min-w-0 flex-1">
                              {item.expiryDate ? (
                                <span className={cn(
                                  "text-[8px] sm:text-[9px] font-bold block truncate",
                                  isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-slate-500"
                                )}>
                                  Val: {new Date(item.expiryDate).toLocaleDateString()}
                                  {isExpired && ' (V)'}
                                  {isExpiringSoon && !isExpired && ' (P)'}
                                </span>
                              ) : (
                                <span className="text-[8px] sm:text-[9px] text-slate-300 font-bold italic block">Sem val.</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => handleEditClick(item)}
                                className="bg-slate-50 border border-slate-200 text-slate-500 p-1.5 rounded-lg active:bg-amber-50 active:text-amber-600 transition-colors"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => handleDelete(item)}
                                className="bg-slate-50 border border-slate-200 text-slate-500 p-1.5 rounded-lg active:bg-red-50 active:text-red-600 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic font-medium">
            Nenhum insumo encontrado.
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Remover Insumo</h3>
              <p className="text-sm text-slate-500">
                Tem certeza que deseja remover "{itemToDelete.name}" do estoque? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (itemToDelete.id) {
                    await deleteIngredient(itemToDelete.id);
                    setItemToDelete(null);
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
