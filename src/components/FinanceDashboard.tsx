import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Wallet, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Plus,
  Minus,
  FileText,
  PieChart,
  BarChart3,
  X,
  Loader2,
  Banknote,
  Landmark,
  CreditCard,
  Package,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { collection, onSnapshot, query, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface SaldoConta {
  id: string;
  valor_atual: number;
}

const SALDO_CONFIG: Record<string, { label: string; icon: React.ReactNode; gradient: string; iconBg: string; border: string }> = {
  dinheiro: { label: 'Dinheiro', icon: <Banknote size={22} />, gradient: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-400/30', border: 'border-emerald-400/30' },
  banco: { label: 'Banco', icon: <Landmark size={22} />, gradient: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-400/30', border: 'border-blue-400/30' },
  cartao: { label: 'Cartão', icon: <CreditCard size={22} />, gradient: 'from-purple-500 to-purple-600', iconBg: 'bg-purple-400/30', border: 'border-purple-400/30' },
};

export default function FinanceDashboard({ onNavigate }: { onNavigate: (tab: 'dashboard' | 'finance' | 'inventory' | 'recipes' | 'sales' | 'movements' | 'contas_pagar') => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [saldos, setSaldos] = useState<SaldoConta[]>([]);
  const [saldosLoading, setSaldosLoading] = useState(true);
  const [ingredients, setIngredients] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'receita' | 'despesa'>('receita');
  const [submitting, setSubmitting] = useState(false);

  // Transactions listener
  useEffect(() => {
    const q = query(collection(db, 'transacoes'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any)
      }));
      data.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transacoes');
    });
    return () => unsub();
  }, []);

  // Saldos listener (real-time)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'saldos_contas'), (snapshot) => {
      const data: SaldoConta[] = snapshot.docs.map((d) => ({
        id: d.id,
        valor_atual: (d.data() as any).valor_atual || 0,
      }));
      setSaldos(data);
      setSaldosLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'saldos_contas');
    });
    return () => unsub();
  }, []);

  // Ingredients listener (for stock value calculation)
  useEffect(() => {
    const q = query(collection(db, 'produtos'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((d) => d.tipo === 'insumo');
      setIngredients(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'produtos');
    });
    return () => unsub();
  }, []);

  const getSaldo = (id: string): number => saldos.find(s => s.id === id)?.valor_atual || 0;

  // Dynamic stock value calculation
  const investidoEmEstoque = ingredients.reduce((acc, ing) => {
    return acc + ((Number(ing.currentStock) || 0) * (Number(ing.costPrice) || 0));
  }, 0);

  const saldoDinheiro = getSaldo('dinheiro');
  const saldoBanco = getSaldo('banco');
  const saldoCartao = getSaldo('cartao');
  const patrimonioTotal = saldoDinheiro + saldoBanco + saldoCartao + investidoEmEstoque;

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Filter transactions by current month and year
  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  });

  const financialData = {
    balance: filteredTransactions.reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valor : -t.valor), 0),
    expensesGoods: filteredTransactions.filter(t => t.tipo === 'despesa' && t.categoria === 'insumo').reduce((acc, t) => acc + t.valor, 0),
    expensesStaff: filteredTransactions.filter(t => t.tipo === 'despesa' && t.categoria === 'rh').reduce((acc, t) => acc + t.valor, 0),
    revenue: filteredTransactions.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0),
  };

  const totalOtherExpenses = filteredTransactions
    .filter(t => t.tipo === 'despesa' && t.categoria !== 'insumo' && t.categoria !== 'rh')
    .reduce((acc, t) => acc + t.valor, 0);

  const totalExpenses = financialData.expensesGoods + financialData.expensesStaff + totalOtherExpenses;
  const netProfit = financialData.revenue - totalExpenses;

  // Chart Logic (Simple Visual Bars)
  const maxBarValue = Math.max(financialData.revenue, totalExpenses, 1);
  const revenueHeight = `${(financialData.revenue / maxBarValue) * 100}%`;
  const expensesHeight = `${(totalExpenses / maxBarValue) * 100}%`;

  const profitMargin = financialData.revenue > 0 ? (netProfit / financialData.revenue) * 100 : 0;

  const handleOpenModal = (type: 'receita' | 'despesa') => {
    setTransactionType(type);
    setIsModalOpen(true);
  };

  const handleSubmitTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const newTx = {
      tipo: transactionType,
      valor: Number(formData.get('valor')),
      descricao: formData.get('descricao') as string,
      categoria: formData.get('categoria') as string,
      data: formData.get('data') as string || new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'transacoes'), newTx);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transacoes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 bg-slate-50 min-h-full p-2 sm:p-6 pb-24 relative">
      
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 uppercase italic flex items-center gap-2">
            <Building2 className="text-indigo-600" size={24} />
            Central de Caixa e Patrimônio
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Gestão unificada de saldos, estoque e fluxo de caixa
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-sm rounded-xl p-1.5">
          <button 
            onClick={handlePrevMonth}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-black text-slate-700 min-w-[140px] text-center uppercase tracking-widest">
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PAINEL DE SALDOS E PATRIMÔNIO */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Saldo Dinheiro */}
        {(['dinheiro', 'banco', 'cartao'] as const).map((id) => {
          const cfg = SALDO_CONFIG[id];
          const val = getSaldo(id);
          return (
            <div
              key={id}
              className={cn(
                "bg-gradient-to-br text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02]",
                cfg.gradient
              )}
            >
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", cfg.iconBg)}>
                    {cfg.icon}
                  </div>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70 mb-1">
                  {cfg.label}
                </p>
                {saldosLoading ? (
                  <Loader2 size={18} className="animate-spin text-white/60" />
                ) : (
                  <p className={cn("text-lg sm:text-xl font-mono font-black tracking-tighter", val < 0 && "text-red-200")}>
                    {formatCurrency(val)}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Investido em Estoque */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02]">
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-400/30">
                <Package size={22} />
              </div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/70 mb-1">
              Em Estoque
            </p>
            <p className="text-lg sm:text-xl font-mono font-black tracking-tighter">
              {formatCurrency(investidoEmEstoque)}
            </p>
          </div>
        </div>

        {/* Patrimônio Total */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden transition-all hover:shadow-2xl hover:scale-[1.02] border border-slate-700/50">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-indigo-500/10 rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/30">
                <ShieldCheck size={22} />
              </div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">
              Patrimônio Total
            </p>
            {saldosLoading ? (
              <Loader2 size={18} className="animate-spin text-white/60" />
            ) : (
              <p className={cn(
                "text-xl sm:text-2xl font-mono font-black tracking-tighter",
                patrimonioTotal < 0 ? "text-red-400" : "text-white"
              )}>
                {formatCurrency(patrimonioTotal)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Main Left Column */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Top Bank Card */}
          <div className="bg-slate-900 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 sm:gap-8">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-indigo-500/20 to-transparent pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 text-white/[0.03] pointer-events-none">
              <Wallet size={300} />
            </div>

            <div className="relative z-10 w-full sm:w-auto text-center sm:text-left">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-slate-400 flex items-center justify-center sm:justify-start gap-2 mb-3">
                <Wallet size={16} /> Saldo Líquido do Mês
              </span>
              <h1 className={cn(
                "text-3xl sm:text-5xl lg:text-7xl font-mono font-black tracking-tighter",
                financialData.balance >= 0 ? "text-white" : "text-red-400"
              )}>
                {formatCurrency(financialData.balance)}
              </h1>
            </div>

            <div className="relative z-10 flex flex-row gap-3 w-full sm:w-auto">
              <button 
                onClick={() => handleOpenModal('receita')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
              >
                <Plus size={16} strokeWidth={3} /> Receita
              </button>
              <button 
                onClick={() => handleOpenModal('despesa')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-rose-950 px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/25"
              >
                <Minus size={16} strokeWidth={3} /> Despesa
              </button>
            </div>
          </div>

          {/* Cash Flow Chart Area */}
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={18} /> Fluxo de Caixa (Mensal)
              </h3>
            </div>
            
            <div className="h-[160px] sm:h-[200px] flex items-end justify-center gap-8 sm:gap-12 lg:gap-24">
              {/* Entradas */}
              <div className="flex flex-col items-center gap-3 w-24 group">
                <span className="text-sm font-mono text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-emerald-50 px-2 py-1 rounded absolute -mt-10">
                  {formatCurrency(financialData.revenue)}
                </span>
                <div className="w-full bg-emerald-100 rounded-t-xl overflow-hidden relative flex items-end justify-center h-full max-h-[160px]">
                   <div 
                     className="w-full bg-emerald-500 hover:bg-emerald-400 transition-all duration-1000 ease-out" 
                     style={{ height: revenueHeight || '0%' }}
                   />
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">Entradas</span>
              </div>
              
              {/* Saídas */}
              <div className="flex flex-col items-center gap-3 w-24 group relative">
                <span className="text-sm font-mono text-rose-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-rose-50 px-2 py-1 rounded absolute -mt-10">
                  {formatCurrency(totalExpenses)}
                </span>
                <div className="w-full bg-rose-100 rounded-t-xl overflow-hidden relative flex items-end justify-center h-full max-h-[160px]">
                   <div 
                     className="w-full bg-rose-500 hover:bg-rose-400 transition-all duration-1000 ease-out" 
                     style={{ height: expensesHeight || '0%' }}
                   />
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">Saídas</span>
              </div>
            </div>
          </div>

          {/* Detailed Statement Table */}
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-[2rem] shadow-sm overflow-hidden flex flex-col flex-1 min-h-[300px] sm:min-h-[400px]">
            <div className="p-4 sm:p-8 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <FileText className="text-indigo-600" size={18} /> Extrato Detalhado do Mês
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 sm:p-4 pl-4 sm:pl-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="p-3 sm:p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="p-3 sm:p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Categoria</th>
                    <th className="p-3 sm:p-4 pr-4 sm:pr-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 font-medium italic text-sm">
                        Nenhum registro encontrado para este mês.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                        <td className="p-3 sm:p-4 pl-4 sm:pl-8 text-xs font-bold text-slate-500 tracking-wide whitespace-nowrap">
                          {new Date(tx.data).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3 sm:p-4 text-xs sm:text-sm font-bold text-slate-800">
                          {tx.descricao}
                        </td>
                        <td className="p-3 sm:p-4 hidden sm:table-cell">
                          <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase tracking-wider">
                            {tx.categoria}
                          </span>
                        </td>
                        <td className="p-3 sm:p-4 pr-4 sm:pr-8 text-right">
                          <span className={cn(
                            "text-xs sm:text-sm font-mono font-black whitespace-nowrap",
                            tx.tipo === 'receita' ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {tx.tipo === 'receita' ? '+' : '-'} {formatCurrency(tx.valor)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Lateral Summary (DRE Simplificado) */}
        <div className="xl:col-span-4 flex flex-col gap-6 h-full">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 shadow-sm flex-1">
            
            <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
              <PieChart className="text-indigo-600" size={18} />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                DRE Simplificado <span className="text-xs text-slate-400">(Mês atual)</span>
              </h3>
            </div>

            <div className="space-y-8">
              
              {/* Receitas */}
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Receita Bruta Total</p>
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-2xl font-mono font-bold text-slate-800">{formatCurrency(financialData.revenue)}</h4>
                  <ArrowUpRight className="text-emerald-500" size={20} />
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full" />

              {/* Custos */}
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1">Custo Mercadorias (CMV)</p>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-mono font-medium text-slate-700">{formatCurrency(financialData.expensesGoods)}</h4>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {financialData.revenue > 0 ? Math.round((financialData.expensesGoods / financialData.revenue) * 100) : 0}% div.
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1">Custo Equipe/RH</p>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-mono font-medium text-slate-700">{formatCurrency(financialData.expensesStaff)}</h4>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {financialData.revenue > 0 ? Math.round((financialData.expensesStaff / financialData.revenue) * 100) : 0}% div.
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1">Outras Despesas</p>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-mono font-medium text-slate-700">{formatCurrency(totalOtherExpenses)}</h4>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {financialData.revenue > 0 ? Math.round((totalOtherExpenses / financialData.revenue) * 100) : 0}% div.
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full" />

              {/* Lucro */}
              <div className={cn(
                "p-6 rounded-2xl border-2",
                netProfit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
              )}>
                <p className={cn(
                  "text-[11px] font-black uppercase tracking-[0.2em] mb-2",
                  netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                )}>
                  Lucro Líquido (Mês)
                </p>
                <div className="flex justify-between items-end">
                  <h4 className={cn(
                    "text-2xl sm:text-3xl font-mono font-black tracking-tighter",
                    netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {formatCurrency(netProfit)}
                  </h4>
                  <span className={cn(
                    "font-bold text-sm",
                    netProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {Math.round(profitMargin)}% mg
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                {transactionType === 'receita' ? (
                  <><Plus className="text-emerald-500" /> Nova Receita</>
                ) : (
                  <><Minus className="text-rose-500" /> Nova Despesa</>
                )}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                  Valor (R$)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="valor"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                  Descrição
                </label>
                <input 
                  type="text"
                  name="descricao"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ex: Venda avulsa, Conta de Luz..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                    Categoria
                  </label>
                  <select 
                    name="categoria"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  >
                    {transactionType === 'receita' ? (
                      <>
                        <option value="venda">Vendas</option>
                        <option value="outros">Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="insumo">Insumos/Mercadorias</option>
                        <option value="rh">Equipe/RH</option>
                        <option value="marketing">Marketing</option>
                        <option value="imposto">Impostos</option>
                        <option value="outros">Outros</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                    Data
                  </label>
                  <input 
                    type="date"
                    name="data"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "px-8 py-3 rounded-xl font-black uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none flex items-center gap-2",
                    transactionType === 'receita' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"
                  )}
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
