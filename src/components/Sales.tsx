import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { ShoppingCart, ShoppingBag, Plus, Minus, CheckCircle, AlertCircle, Pizza, CreditCard, Banknote, QrCode, Zap, Bike } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

export default function Sales() {
  const { products, ingredients, sellProduct, loading } = useInventory();
  const [cart, setCart] = useState<{ productId: string; quantity: number; salePrice: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isSeeding, setIsSeeding] = useState(false);

  const paymentOptions = [
    { id: 'PIX', label: 'Pix', icon: QrCode, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', activeBg: 'bg-teal-600', activeBorder: 'border-teal-700' },
    { id: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', activeBg: 'bg-indigo-600', activeBorder: 'border-indigo-700' },
    { id: 'CARTAO_DEBITO', label: 'Débito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', activeBg: 'bg-blue-600', activeBorder: 'border-blue-700' },
    { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', activeBg: 'bg-emerald-600', activeBorder: 'border-emerald-700' },
  ];

  const addToCart = (productId: string, salePrice: number) => {
    const existing = cart.find(item => item.productId === productId);
    if (existing) {
      setCart(cart.map(item => 
        item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { productId, quantity: 1, salePrice }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.productId === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item => 
        item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item
      ));
    } else {
      setCart(cart.filter(item => item.productId !== productId));
    }
  };

  const handleCheckout = async () => {
    if (!paymentMethod) {
      alert("Selecione um método de pagamento!");
      return;
    }
    
    setIsProcessing(true);
    try {
      await sellProduct(cart, paymentMethod, deliveryFee);
      setCart([]);
      setPaymentMethod('');
      setDeliveryFee(0);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const seedMockData = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      
      // Criar Insumos
      const ingref1 = doc(collection(db, 'ingredients'));
      batch.set(ingref1, { name: 'Massa Artesanal', unit: 'un', currentStock: 50, minStock: 10, costPrice: 3.5, lastUpdated: new Date().toISOString() });
      const ingref2 = doc(collection(db, 'ingredients'));
      batch.set(ingref2, { name: 'Queijo Mussarela', unit: 'kg', currentStock: 10, minStock: 2, costPrice: 35.0, lastUpdated: new Date().toISOString() });
      const ingref3 = doc(collection(db, 'ingredients'));
      batch.set(ingref3, { name: 'Pepperoni', unit: 'kg', currentStock: 5, minStock: 1, costPrice: 65.0, lastUpdated: new Date().toISOString() });
      const ingref4 = doc(collection(db, 'ingredients'));
      batch.set(ingref4, { name: 'Guaraná 1L', unit: 'un', currentStock: 24, minStock: 6, costPrice: 4.5, lastUpdated: new Date().toISOString() });
      const ingref5 = doc(collection(db, 'ingredients'));
      batch.set(ingref5, { name: 'Coca-Cola 2L', unit: 'un', currentStock: 12, minStock: 4, costPrice: 7.0, lastUpdated: new Date().toISOString() });

      // Criar Produtos
      const p1 = doc(collection(db, 'products'));
      batch.set(p1, { 
        name: 'Pizza Pepperoni Média', category: 'Pizzas', salePrice: 45.0, isActive: true, imageUrl: '',
        recipe: [
          { ingredientId: ingref1.id, name: 'Massa Artesanal', quantity: 1, unit: 'un', currentCost: 3.5 },
          { ingredientId: ingref2.id, name: 'Queijo Mussarela', quantity: 0.25, unit: 'kg', currentCost: 35.0 },
          { ingredientId: ingref3.id, name: 'Pepperoni', quantity: 0.15, unit: 'kg', currentCost: 65.0 }
        ]
      });

      const p2 = doc(collection(db, 'products'));
      batch.set(p2, { 
        name: 'Guaraná Antarctica 1L', category: 'Bebidas', salePrice: 10.0, isActive: true, imageUrl: '',
        recipe: [{ ingredientId: ingref4.id, name: 'Guaraná 1L', quantity: 1, unit: 'un', currentCost: 4.5 }]
      });

      const p3 = doc(collection(db, 'products'));
      batch.set(p3, { 
        name: 'Coca-Cola 2L', category: 'Bebidas', salePrice: 14.0, isActive: true, imageUrl: '',
        recipe: [{ ingredientId: ingref5.id, name: 'Coca-Cola 2L', quantity: 1, unit: 'un', currentCost: 7.0 }]
      });

      await batch.commit();
      alert("Mock Data de Vendas gerado com sucesso! Aguarde a sincronização.");
    } catch(e) {
       console.error(e);
       alert("Erro ao seedar!");
    } finally {
      setIsSeeding(false);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + item.salePrice * item.quantity, 0);
  const total = subtotal + deliveryFee;

  const getEffectiveRecipe = (product: any) => {
    let effectiveRecipe = product?.ficha_tecnica || [];
    if (effectiveRecipe.length === 0 && product) {
      const matchingIng = ingredients.find(i => 
        i.name.trim().toLowerCase() === product.nome.trim().toLowerCase()
      );
      if (matchingIng) {
        effectiveRecipe = [{ insumoId: matchingIng.id!, quantidade: 1, nome_insumo: matchingIng.name }];
      }
    }
    return effectiveRecipe;
  };

  // Check if any ingredient in the cart will exceed stock
  const getStockWarnings = () => {
    const needed: Record<string, number> = {};
    cart.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const recipe = getEffectiveRecipe(product);
      recipe.forEach((ri: any) => {
        needed[ri.insumoId] = (needed[ri.insumoId] || 0) + (ri.quantidade * item.quantity);
      });
    });

    const warnings: string[] = [];
    Object.entries(needed).forEach(([ingId, qty]) => {
      const ing = ingredients.find(i => i.id === ingId);
      if (ing && ing.currentStock < qty) {
        warnings.push(`Estoque insuficiente de ${ing.name} (Necessário: ${qty}${ing.unit}, Disponível: ${ing.currentStock}${ing.unit})`);
      }
    });
    return warnings;
  };

  const warnings = getStockWarnings();

  if (loading) {
    return <div className="p-20 text-center animate-pulse text-slate-400 font-medium italic">Sincronizando cardápio digital...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:h-[calc(100vh-8rem)]">
      {/* Left Area - Products */}
      <div className="lg:col-span-8 flex flex-col lg:h-full space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:overflow-hidden">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 uppercase italic">Frente de Caixa (PDV)</h2>
          <p className="text-slate-500 text-xs sm:text-sm">Opere vendas rápidas e registre no fluxo de caixa instantaneamente.</p>
        </div>

        {/* Categories / Seed Button */}
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar shrink-0">
          {['Todos', 'Pizzas', 'Bebidas', 'Sobremesas'].map(cat => (
            <button 
              key={cat} 
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                cat === categoryFilter 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "bg-white border border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-600"
              )}
            >
              {cat}
            </button>
          ))}
          {products.length === 0 && (
             <button 
               onClick={seedMockData}
               disabled={isSeeding}
               className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] bg-amber-100 text-amber-700 font-black border border-amber-200 hover:bg-amber-200 transition-colors uppercase"
             >
               <Zap size={14} /> GERAR DADOS DE TESTE (MOCK)
             </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:overflow-y-auto pb-6 lg:pr-2 custom-scrollbar">
          {products.length === 0 && !loading && (
             <div className="col-span-full py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                 <ShoppingCart size={48} className="text-slate-300 mb-4" />
                 <h3 className="font-bold text-slate-600 text-lg">Nenhum produto cadastrado</h3>
                 <p className="text-slate-400 text-sm max-w-md mt-2">Clique em "Gerar dados de Teste" para adicionar pizzas e bebidas automaticamente ou cadastre novos no menu principal.</p>
             </div>
          )}
          
          {products
            .filter(p => (categoryFilter === 'Todos' || p.categoria.toLowerCase() === categoryFilter.toLowerCase()))
            .map(product => {
              const isOutOfStock = warnings.some(w => w.includes(product.nome)); // Simplified visual block
              
              return (
                <button 
                  key={product.id}
                  onClick={() => addToCart(product.id!, product.preco_venda)}
                  className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl text-left hover:shadow-xl hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all group relative overflow-hidden flex flex-col active:scale-95 h-[160px] sm:h-[180px]"
                >
                  <div className="bg-slate-50 w-full flex-1 rounded-xl mb-3 flex items-center justify-center text-slate-200 group-hover:bg-indigo-50/50 group-hover:text-indigo-200 transition-colors">
                    <Pizza size={40} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">{product.categoria}</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight mt-0.5 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2 uppercase italic">{product.nome}</h4>
                    <p className="font-mono text-base font-black text-slate-900">{formatCurrency(product.preco_venda)}</p>
                  </div>
                </button>
              );
          })}
        </div>
      </div>

      {/* Right Area - Cart Panel */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl flex flex-col lg:h-full shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 max-h-[60vh] lg:max-h-none">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between z-10 shrink-0">
          <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-800 flex items-center gap-2">
            <ShoppingBag size={18} className="text-indigo-600" /> Pedido #{(Math.floor(Math.random() * 9000) + 1000)}
          </h3>
          <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full uppercase tracking-widest border border-indigo-200">{cart.length} itens</span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar z-0 bg-slate-50/30">
          <AnimatePresence mode="popLayout" initial={false}>
            {cart.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center pb-20 opacity-50"
              >
                <ShoppingCart size={48} strokeWidth={1} className="text-slate-400 mb-4" />
                <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Carrinho Vazio</p>
              </motion.div>
            ) : (
              cart.map(item => {
                const product = products.find(p => p.id === item.productId);
                return (
                  <motion.div 
                    key={item.productId}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="flex justify-between items-start gap-4 bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate uppercase italic">{product?.nome}</p>
                      <p className="text-xs text-slate-500 font-mono font-medium mt-0.5">{formatCurrency(item.salePrice)} Un.</p>
                      <p className="text-sm font-mono font-black text-indigo-700 mt-1">{formatCurrency(item.salePrice * item.quantity)}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 shrink-0 bg-slate-50 rounded-lg p-1 border border-slate-100">
                      <button 
                        onClick={() => addToCart(item.productId, item.salePrice)} 
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="font-mono text-sm font-black text-slate-800 min-w-[2rem] text-center">{item.quantity}</span>
                      <button 
                        onClick={() => removeFromCart(item.productId)} 
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 shadow-sm transition-all"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

         {/* Warnings */}
        <AnimatePresence>
          {warnings.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-5 pb-4 overflow-hidden shrink-0"
            >
               <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                 <div className="flex items-center gap-2 text-[10px] font-black text-red-600 uppercase tracking-widest mb-1.5">
                    <AlertCircle size={14} /> Faltará Estoque:
                 </div>
                 {warnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-red-700 font-medium leading-tight mb-0.5">
                      • {w}
                    </p>
                 ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary & Checkout */}
        <div className="bg-slate-900 text-white rounded-t-3xl pt-6 px-6 pb-6 shrink-0 relative mt-auto shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.3)]">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
              <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
            </div>
            
            {/* Delivery Toggle Row */}
            <div className="flex justify-between items-center group">
              <button 
                onClick={() => setDeliveryFee(deliveryFee === 0 ? 8.5 : 0)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
                disabled={cart.length === 0}
              >
                <div className={cn("p-1.5 rounded-full border", deliveryFee > 0 ? "bg-amber-500 border-amber-400 text-slate-900" : "bg-slate-800 border-slate-700 text-slate-400")}>
                  <Bike size={14} />
                </div>
                Adicionar Taxa Moto?
              </button>
              <span className={cn("font-mono font-bold", deliveryFee > 0 ? "text-amber-400" : "text-slate-400")}>
                {deliveryFee > 0 ? `+ ${formatCurrency(deliveryFee)}` : 'R$ 0,00'}
              </span>
            </div>

            <div className="h-px bg-slate-800 my-2" />
            
            <div className="flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-300">Total a Pagar</span>
              <span className="text-2xl sm:text-4xl font-mono font-black text-white tracking-tighter">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2.5 mb-6">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.15em]">Forma de Pagamento:</label>
            <div className="grid grid-cols-4 gap-2">
               {paymentOptions.map(opt => {
                 const isActive = paymentMethod === opt.id;
                 const Icon = opt.icon;
                 return (
                   <button
                     key={opt.id}
                     onClick={() => setPaymentMethod(opt.id)}
                     disabled={cart.length === 0}
                     className={cn(
                       "flex flex-col items-center justify-center p-2 rounded-xl transition-all border",
                       "focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                       isActive 
                         ? `${opt.activeBg} ${opt.activeBorder} text-white shadow-lg` 
                         : `bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white`
                     )}
                   >
                     <Icon size={18} className="mb-1" />
                     <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight">{opt.label}</span>
                   </button>
                 );
               })}
            </div>
          </div>
          
          {/* Finalize Button */}
          <button 
            disabled={cart.length === 0 || isProcessing || warnings.length > 0 || !paymentMethod}
            onClick={handleCheckout}
            className={cn(
              "w-full py-4 rounded-2xl font-black uppercase text-sm tracking-[0.2em] transition-all relative overflow-hidden",
              (!paymentMethod && cart.length > 0 && warnings.length === 0) 
                 ? "bg-slate-700 text-slate-400 border border-slate-600 animate-pulse" 
                 : cart.length === 0 || warnings.length > 0
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                    : "bg-emerald-500 text-slate-900 hover:bg-emerald-400 active:scale-95 shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)]"
            )}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />
                PROCESSANDO...
              </span>
            ) : !paymentMethod && cart.length > 0 && warnings.length === 0 ? (
              "SELECIONE O PAGAMENTO"
            ) : (
               "FINALIZAR VENDA"
            )}
            
            {/* Shimmer effect when button is ready */}
            {paymentMethod && cart.length > 0 && warnings.length === 0 && !isProcessing && (
              <div className="absolute inset-0 -translate-x-[150%] animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
            )}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-white p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              
              <div className="mb-6 relative">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                >
                  <CheckCircle size={40} className="text-emerald-600" />
                </motion.div>
              </div>

              <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">Sucesso!</h3>
              <p className="text-slate-500 text-sm font-medium mt-2">Venda registrada e controle de estoque atualizado!</p>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
