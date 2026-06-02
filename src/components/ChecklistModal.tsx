import React, { useState, useEffect } from 'react';
import { X, Printer, MessageCircle, FileText, Trash2 } from 'lucide-react';
import { Ingredient } from '../types';

interface PurchaseItem {
  id: string;
  ingredientId: string;
  quantity: string;
  costPrice: string;
}

interface ChecklistModalProps {
  items: PurchaseItem[];
  ingredients: Ingredient[];
  onClose: () => void;
}

interface EditableItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  currentStock: number;
  minStock: number;
}

export default function ChecklistModal({ items, ingredients, onClose }: ChecklistModalProps) {
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);

  useEffect(() => {
    const initial = items.map(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      return {
        id: item.id, // We use PurchaseItem's unique id to track edits
        name: ing ? ing.name : 'Produto Desconhecido',
        quantity: item.quantity || '0',
        unit: ing ? ing.unit : 'un',
        category: ing ? ing.category : 'Outros',
        currentStock: ing ? Math.max(0, ing.currentStock) : 0,
        minStock: ing ? ing.minStock : 0,
      };
    });
    setEditableItems(initial);
  }, [items, ingredients]);

  const [showPrintWarning, setShowPrintWarning] = useState(false);

  const handleRemove = (id: string) => {
    setEditableItems(prev => prev.filter(i => i.id !== id));
  };

  const handleChange = (id: string, field: keyof EditableItem, value: string) => {
    setEditableItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handlePrint = () => {
    if (window !== window.top) {
      setShowPrintWarning(true);
      setTimeout(() => setShowPrintWarning(false), 8000);
    } else {
      window.print();
    }
  };

  const handleWhatsApp = () => {
    const text = `*Lista de Compras - Reposição*\n\n` +
      editableItems.map(ing => {
        return `[ ] ${ing.name} - ${ing.quantity} ${ing.unit} _(Atual: ${ing.currentStock}/${ing.minStock})_`;
      }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            height: auto;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            background: white !important;
          }
          .print-hidden-element {
            display: none !important;
          }
          input, select {
            border: none !important;
            background: transparent !important;
            appearance: none;
            -moz-appearance: none;
            -webkit-appearance: none;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
          }
        }
      `}</style>

      <div id="print-section" className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header (No print) */}
        <div className="print-hidden-element px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <FileText size={20} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                Checklist de Reposição
              </h2>
              <span className="text-xs text-slate-500 font-medium">Revise a quantidade e unidade antes de imprimir</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Print Header */}
        <div className="hidden print:block p-8 pb-4 border-b-2 border-slate-800 mb-4">
          <h1 className="text-3xl font-black uppercase text-slate-900">Solicitação de Compras</h1>
          <p className="text-sm font-bold text-slate-500 mt-2">Gerado em {new Date().toLocaleDateString()}</p>
        </div>

        {/* Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50 print:bg-white print:overflow-visible print:h-auto">
          {editableItems.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white rounded-xl border border-slate-200">
              <p className="font-bold">Nenhum item na lista de compra.</p>
              <p className="text-xs mt-1">Sua solicitação de compra está vazia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {editableItems.map(item => {
                const ratio = item.minStock > 0 ? item.currentStock / item.minStock : 0;
                const isCritical = item.currentStock <= 0 || ratio <= 0.25;

                return (
                  <div key={item.id} className="bg-white border border-slate-200 print:border-b print:border-transparent print:border-b-slate-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center shadow-sm relative group">
                    
                    <div className="flex-1 w-full flex flex-col pt-1">
                      <div className="flex items-center gap-2">
                        <div className="hidden print:block w-4 h-4 border-2 border-slate-800 rounded-sm shrink-0 mt-0.5"></div>
                        <h4 className="font-bold text-slate-800 text-sm md:text-base leading-tight">{item.name}</h4>
                      </div>
                      <span className="print-hidden-element text-[10px] uppercase font-black tracking-widest text-slate-400 mt-0.5">
                         {item.category}
                      </span>
                    </div>

                    <div className="flex w-full sm:w-auto items-center gap-2 mt-2 sm:mt-0">
                      <div className="flex items-center gap-2 flex-1 sm:flex-none">
                        <input 
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleChange(item.id, 'quantity', e.target.value)}
                          className="w-full sm:w-24 text-right font-black text-indigo-700 print:text-slate-900 bg-slate-50 print:bg-transparent border border-slate-200 print:border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none h-[42px]"
                          placeholder="Qtd"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => handleChange(item.id, 'unit', e.target.value)}
                          className="w-24 text-sm font-bold text-slate-600 print:text-slate-900 bg-slate-50 print:bg-transparent border border-slate-200 print:border-none rounded-lg px-2 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none h-[42px]"
                        >
                          <option value="un">un</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                          <option value="cx">cx</option>
                          <option value="pc">pc</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 print-hidden-element shrink-0">
                        <div className="text-right text-slate-500 font-mono text-[10px] sm:text-xs">
                          <span className={isCritical ? "text-red-500 font-bold" : ""}>{item.currentStock}</span>
                          <span className="text-slate-300 px-1">/</span>
                          <span title="Estoque mínimo">{item.minStock}</span>
                        </div>
                        
                        <button 
                          onClick={() => handleRemove(item.id)}
                          className="text-slate-400 hover:text-red-500 p-2 sm:p-2.5 rounded-lg hover:bg-red-50 transition-colors bg-slate-50 hover:border-red-100 border border-transparent"
                          title="Remover da lista"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer (No print) */}
        <div className="print-hidden-element px-6 py-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-4 shrink-0">
          {showPrintWarning && (
            <div className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-4 py-3 rounded-lg font-bold flex items-start gap-2">
              ⚠️ O navegador bloqueia a impressão dentro do preview. Para imprimir, abra o sistema em uma nova aba clicando no ícone no canto superior direito.
            </div>
          )}
          <div className="flex justify-end gap-3 flex-wrap">
            <button 
              type="button"
              onClick={handleWhatsApp}
              disabled={editableItems.length === 0}
              className="px-6 py-2.5 text-emerald-700 bg-emerald-100 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <MessageCircle size={16} /> WhatsApp
            </button>
            <button 
              type="button"
              onClick={handlePrint}
              disabled={editableItems.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-2 border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50"
            >
              <Printer size={16} /> Imprimir PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
