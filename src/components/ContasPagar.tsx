import React, { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Banknote,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  Search,
  Filter,
  Landmark,
  Wallet,
  ArrowRight,
  Ban,
  CalendarClock,
  Eye
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface ContaPagar {
  id: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  formaPagamento: 'boleto' | 'cartao' | 'dinheiro';
  pago: boolean;
  dataCriacao: string;
}

interface SaldoConta {
  id: string;
  valor_atual: number;
}

const FORMA_PAGAMENTO_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  boleto: { label: 'Boleto', icon: <FileText size={14} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  cartao: { label: 'Cartão', icon: <CreditCard size={14} />, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  dinheiro: { label: 'Dinheiro', icon: <Banknote size={14} />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// Map forma de pagamento -> saldos_contas document id
const FORMA_TO_SALDO_DOC: Record<string, string> = {
  dinheiro: 'dinheiro',
  cartao: 'cartao',
  boleto: 'banco',
};

const SALDO_LABELS: Record<string, { label: string; icon: React.ReactNode; gradient: string; iconBg: string }> = {
  dinheiro: { label: 'Dinheiro', icon: <Banknote size={20} />, gradient: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-400/30' },
  banco: { label: 'Banco', icon: <Landmark size={20} />, gradient: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-400/30' },
  cartao: { label: 'Cartão', icon: <CreditCard size={20} />, gradient: 'from-purple-500 to-purple-600', iconBg: 'bg-purple-400/30' },
};

type FilterMode = 'data' | 'atrasadas' | 'todos';

export default function ContasPagar() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [saldos, setSaldos] = useState<SaldoConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saldosLoading, setSaldosLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [baixaLoading, setBaixaLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMode, setFilterMode] = useState<FilterMode>('data');

  // Form state
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [formaPagamento, setFormaPagamento] = useState<'boleto' | 'cartao' | 'dinheiro'>('boleto');

  // Delete confirmation
  const [contaToDelete, setContaToDelete] = useState<string | null>(null);

  const hoje = new Date().toISOString().split('T')[0];

  // Initialize saldo documents if they don't exist
  useEffect(() => {
    const initSaldos = async () => {
      const saldoIds = ['dinheiro', 'banco', 'cartao'];
      for (const id of saldoIds) {
        const ref = doc(db, 'saldos_contas', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, { valor_atual: 0 });
        }
      }
    };
    initSaldos().catch((error) => {
      console.error('Erro ao inicializar saldos:', error);
    });
  }, []);

  // Real-time listener: contas_pagar
  useEffect(() => {
    const q = query(collection(db, 'contas_pagar'), orderBy('dataVencimento', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: ContaPagar[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ContaPagar, 'id'>),
      }));
      setContas(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contas_pagar');
    });

    return () => unsub();
  }, []);

  // Real-time listener: saldos_contas
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !valor || !dataVencimento) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'contas_pagar'), {
        descricao: descricao.trim(),
        valor: parseFloat(valor),
        dataVencimento,
        formaPagamento,
        pago: false,
        dataCriacao: new Date().toISOString(),
      });

      // Reset form
      setDescricao('');
      setValor('');
      setDataVencimento(new Date().toISOString().split('T')[0]);
      setFormaPagamento('boleto');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contas_pagar');
    } finally {
      setSubmitting(false);
    }
  };

  // "Dar Baixa" — atomic transaction: mark as paid + deduct from saldo
  const handleDarBaixa = async (conta: ContaPagar) => {
    if (conta.pago) return;
    setBaixaLoading(conta.id);

    try {
      const saldoDocId = FORMA_TO_SALDO_DOC[conta.formaPagamento] || 'banco';
      const contaRef = doc(db, 'contas_pagar', conta.id);
      const saldoRef = doc(db, 'saldos_contas', saldoDocId);

      await runTransaction(db, async (transaction) => {
        const saldoSnap = await transaction.get(saldoRef);
        const saldoAtual = saldoSnap.exists() ? (saldoSnap.data().valor_atual || 0) : 0;

        // Update conta status
        transaction.update(contaRef, { pago: true });

        // Deduct from saldo
        transaction.update(saldoRef, { valor_atual: saldoAtual - conta.valor });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'contas_pagar');
    } finally {
      setBaixaLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!contaToDelete) return;
    try {
      await deleteDoc(doc(db, 'contas_pagar', contaToDelete));
      setContaToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'contas_pagar');
    }
  };

  const isVencida = (data: string, pago: boolean) => {
    if (pago) return false;
    return data < hoje;
  };

  const isHoje = (data: string) => {
    return data === hoje;
  };

  // Overdue contas
  const contasAtrasadas = contas.filter(c => isVencida(c.dataVencimento, c.pago));
  const totalAtrasado = contasAtrasadas.reduce((acc, c) => acc + c.valor, 0);

  // Filtered list
  const filteredContas = contas.filter((c) => {
    // Search filter
    const matchSearch = c.descricao.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchStatus =
      filterStatus === 'todos' ? true :
      filterStatus === 'pago' ? c.pago :
      !c.pago;

    // Date / mode filter
    let matchDate = true;
    if (filterMode === 'data') {
      matchDate = c.dataVencimento === filterDate;
    } else if (filterMode === 'atrasadas') {
      matchDate = isVencida(c.dataVencimento, c.pago);
    }
    // filterMode === 'todos' → matchDate stays true

    return matchSearch && matchStatus && matchDate;
  });

  // Summary cards
  const totalPendente = contas.filter(c => !c.pago).reduce((acc, c) => acc + c.valor, 0);
  const totalPago = contas.filter(c => c.pago).reduce((acc, c) => acc + c.valor, 0);
  const totalVencido = contasAtrasadas.reduce((acc, c) => acc + c.valor, 0);
  const contasVencidasCount = contasAtrasadas.length;

  // Helper: get saldo value by doc id
  const getSaldo = (id: string): number => {
    return saldos.find(s => s.id === id)?.valor_atual || 0;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic flex items-center gap-3">
            <CircleDollarSign className="text-indigo-600" size={28} />
            Contas a Pagar
          </h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie seus compromissos financeiros e pagamentos pendentes.</p>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {contasAtrasadas.length > 0 && (
        <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-5 shadow-lg shadow-red-100 text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                <AlertTriangle size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-widest">
                  {contasAtrasadas.length} {contasAtrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}
                </h3>
                <p className="text-red-100 text-sm font-medium mt-0.5">
                  Total pendente de <span className="font-black text-white">{formatCurrency(totalAtrasado)}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFilterMode('atrasadas');
                setFilterStatus('todos');
              }}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 border border-white/20 shrink-0"
            >
              <Eye size={14} />
              Ver Atrasadas
            </button>
          </div>
        </div>
      )}

      {/* Saldos Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['dinheiro', 'banco', 'cartao'] as const).map((id) => {
          const info = SALDO_LABELS[id];
          const saldoVal = getSaldo(id);
          return (
            <div
              key={id}
              className={cn(
                "bg-gradient-to-br text-white rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02]",
                info.gradient
              )}
            >
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", info.iconBg)}>
                    {info.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                    {info.label}
                  </span>
                </div>
                {saldosLoading ? (
                  <Loader2 size={20} className="animate-spin text-white/60" />
                ) : (
                  <p className={cn(
                    "text-2xl font-mono font-black tracking-tighter",
                    saldoVal < 0 && "text-red-200"
                  )}>
                    {formatCurrency(saldoVal)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendente</span>
          </div>
          <p className="text-2xl font-mono font-black text-amber-600 tracking-tighter">{formatCurrency(totalPendente)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pago</span>
          </div>
          <p className="text-2xl font-mono font-black text-emerald-600 tracking-tighter">{formatCurrency(totalPago)}</p>
        </div>

        <div className={cn(
          "border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow",
          contasVencidasCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              contasVencidasCount > 0 ? "bg-red-100" : "bg-slate-100"
            )}>
              <AlertTriangle size={20} className={contasVencidasCount > 0 ? "text-red-600" : "text-slate-400"} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Vencido ({contasVencidasCount})
            </span>
          </div>
          <p className={cn(
            "text-2xl font-mono font-black tracking-tighter",
            contasVencidasCount > 0 ? "text-red-600" : "text-slate-300"
          )}>{formatCurrency(totalVencido)}</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-slate-50/80 border-b border-slate-100 p-5 sm:p-6">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <Plus size={18} className="text-indigo-600" />
            Novo Lançamento
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Descrição */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Descrição
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                placeholder="Ex: Fornecedor de Queijo, Conta de Luz"
              />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                placeholder="0,00"
              />
            </div>

            {/* Data Vencimento */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Forma de Pagamento
              </label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as 'boleto' | 'cartao' | 'dinheiro')}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="boleto">Boleto (Banco)</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-5 pt-5 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting || !descricao.trim() || !valor}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Salvando...</>
              ) : (
                <><Plus size={16} strokeWidth={3} /> Adicionar Conta</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Date filter row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-indigo-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">Filtrar por dia:</span>
          </div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setFilterMode('data');
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setFilterDate(hoje);
                setFilterMode('data');
              }}
              className={cn(
                "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                filterMode === 'data' && filterDate === hoje
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              )}
            >
              <span className="flex items-center gap-1.5"><Calendar size={12} /> Hoje</span>
            </button>
            <button
              onClick={() => {
                setFilterMode('atrasadas');
                setFilterStatus('todos');
              }}
              className={cn(
                "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                filterMode === 'atrasadas'
                  ? "bg-red-500 text-white border-red-500 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              )}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Atrasadas
                {contasAtrasadas.length > 0 && (
                  <span className={cn(
                    "ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black",
                    filterMode === 'atrasadas' ? "bg-white/25" : "bg-red-100 text-red-700"
                  )}>
                    {contasAtrasadas.length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setFilterMode('todos')}
              className={cn(
                "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                filterMode === 'todos'
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              )}
            >
              <span className="flex items-center gap-1.5"><Eye size={12} /> Ver Todos</span>
            </button>
          </div>
        </div>

        {/* Search + status row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pt-3 border-t border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <Filter size={14} className="text-slate-300 ml-2" />
            {(['todos', 'pendente', 'pago'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  filterStatus === status
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-white"
                )}
              >
                {status === 'todos' ? 'Todos' : status === 'pendente' ? 'Pendentes' : 'Pagos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current filter indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exibindo:</span>
        {filterMode === 'data' && (
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5">
            <Calendar size={12} />
            {filterDate === hoje ? 'Hoje' : new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        )}
        {filterMode === 'atrasadas' && (
          <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Contas Atrasadas
          </span>
        )}
        {filterMode === 'todos' && (
          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5">
            <Eye size={12} />
            Todos os lançamentos
          </span>
        )}
        <span className="text-slate-300">•</span>
        <span className="font-mono font-bold text-slate-600">{filteredContas.length} {filteredContas.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vencimento</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pagamento</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Valor</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Carregando lançamentos...</p>
                  </td>
                </tr>
              ) : filteredContas.length > 0 ? (
                filteredContas.map((conta) => {
                  const vencida = isVencida(conta.dataVencimento, conta.pago);
                  const hojeConta = isHoje(conta.dataVencimento);
                  const fp = FORMA_PAGAMENTO_LABELS[conta.formaPagamento] || FORMA_PAGAMENTO_LABELS.boleto;
                  const isLoadingBaixa = baixaLoading === conta.id;

                  return (
                    <tr
                      key={conta.id}
                      className={cn(
                        "hover:bg-slate-50 transition-colors group",
                        conta.pago && "opacity-60",
                        vencida && "bg-red-50/50"
                      )}
                    >
                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                            conta.pago
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : vencida
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          {conta.pago ? (
                            <><CheckCircle2 size={12} /> Pago</>
                          ) : vencida ? (
                            <><AlertTriangle size={12} /> Vencida</>
                          ) : (
                            <><Clock size={12} /> Pendente</>
                          )}
                        </span>
                      </td>

                      {/* Descrição */}
                      <td className="px-6 py-4">
                        <p className={cn(
                          "text-sm font-bold text-slate-700 leading-tight max-w-[250px] truncate",
                          conta.pago && "line-through"
                        )} title={conta.descricao}>
                          {conta.descricao}
                        </p>
                      </td>

                      {/* Vencimento */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className={cn(
                            vencida ? "text-red-400" : hojeConta ? "text-amber-400" : "text-slate-300"
                          )} />
                          <span className={cn(
                            "text-xs font-bold font-mono tracking-tighter",
                            vencida ? "text-red-600" : hojeConta ? "text-amber-600" : "text-slate-600"
                          )}>
                            {new Date(conta.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          {hojeConta && !conta.pago && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Hoje</span>
                          )}
                        </div>
                      </td>

                      {/* Forma de Pagamento */}
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                          fp.color
                        )}>
                          {fp.icon} {fp.label}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "font-mono font-black text-sm tracking-tighter",
                          conta.pago ? "text-slate-400" : vencida ? "text-red-600" : "text-slate-800"
                        )}>
                          {formatCurrency(conta.valor)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Dar Baixa button — only for pending */}
                          {!conta.pago && (
                            <button
                              onClick={() => handleDarBaixa(conta)}
                              disabled={isLoadingBaixa}
                              className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Dar baixa e descontar saldo"
                            >
                              {isLoadingBaixa ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              Dar Baixa
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => setContaToDelete(conta.id)}
                            className="bg-white border border-slate-200 text-slate-400 p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100"
                            title="Excluir lançamento"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="bg-slate-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 opacity-30">
                      <CircleDollarSign size={28} className="text-slate-400" />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      {filterMode === 'data'
                        ? `Nenhum lançamento para ${filterDate === hoje ? 'hoje' : new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR')}.`
                        : filterMode === 'atrasadas'
                        ? 'Nenhuma conta atrasada. Tudo em dia! 🎉'
                        : searchTerm || filterStatus !== 'todos'
                        ? 'Nenhum lançamento encontrado com os filtros aplicados.'
                        : 'Nenhuma conta a pagar cadastrada. Use o formulário acima para começar.'}
                    </p>
                    {filterMode !== 'todos' && (
                      <button
                        onClick={() => setFilterMode('todos')}
                        className="mt-4 text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1 mx-auto"
                      >
                        <ArrowRight size={12} /> Ver todos os lançamentos
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {contaToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500">
                Deseja realmente excluir este lançamento? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setContaToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
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
