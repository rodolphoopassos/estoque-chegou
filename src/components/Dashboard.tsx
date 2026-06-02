import React, { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Loader2
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import DailyMovementsWidget from "./DailyMovementsWidget";
import ExpiryControlWidget from "./ExpiryControlWidget";
import { isToday, differenceInDays } from "date-fns";

export default function Dashboard() {
  const [showReportAlert, setShowReportAlert] = useState(false);
  const [loading, setLoading] = useState(true);

  // States para métricas
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [expiringIngredients, setExpiringIngredients] = useState<any[]>([]);
  const [expiredIngredients, setExpiredIngredients] = useState<any[]>([]);
  
  // Movimentações e Transações
  const [todayMovementsCount, setTodayMovementsCount] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    // 1. Escutar Produtos (Insumos)
    const qProdutos = query(collection(db, "produtos"), where("tipo", "==", "insumo"));
    const unsubProdutos = onSnapshot(qProdutos, (snapshot) => {
      let valorTotal = 0;
      const criticos: any[] = [];
      const vencendo: any[] = [];
      const vencidos: any[] = [];
      
      const now = new Date();

      snapshot.forEach((doc) => {
        const p = { id: doc.id, ...doc.data() } as any;
        
        const saldo = Number(p.currentStock) || 0;
        const custo = Number(p.costPrice) || 0;
        const minimo = Number(p.minStock) || 0;

        valorTotal += saldo * custo;

        if (saldo <= minimo) {
          criticos.push(p);
        }

        if (p.expiryDate) {
          const expiryDate = new Date(p.expiryDate);
          const daysDiff = differenceInDays(expiryDate, now);
          
          if (daysDiff < 0) {
            vencidos.push(p);
          } else if (daysDiff <= 15) {
            vencendo.push(p);
          }
        }
      });

      setTotalStockValue(valorTotal);
      setLowStock(criticos);
      setExpiringIngredients(vencendo);
      setExpiredIngredients(vencidos);
      setTotalProducts(snapshot.size);
      
      setLoading(false);
    });

    // 2. Escutar Movimentações
    const qMovimentacoes = collection(db, "movimentacoes");
    const unsubMovimentacoes = onSnapshot(qMovimentacoes, (snapshot) => {
      let countToday = 0;
      snapshot.forEach((doc) => {
        const m = doc.data();
        if (m.date && isToday(new Date(m.date))) {
          countToday++;
        }
      });
      setTodayMovementsCount(countToday);
    });

    // 3. Escutar Transações (Vendas)
    const qTransacoes = query(collection(db, "transacoes"), where("category", "==", "vendas"));
    const unsubTransacoes = onSnapshot(qTransacoes, (snapshot) => {
      let countToday = 0;
      snapshot.forEach((doc) => {
        const t = doc.data();
        if (t.date && isToday(new Date(t.date))) {
          countToday++;
        }
      });
      setTodaySalesCount(countToday);
    });

    return () => {
      unsubProdutos();
      unsubMovimentacoes();
      unsubTransacoes();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-auto text-center sm:text-left">
          <h2 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic text-center w-full">
            Visão Geral <span className="text-indigo-600">Performance</span>
          </h2>
          <p className="text-slate-500 text-sm font-medium text-center w-full">
            Monitoramento real-time do seu estoque e produção.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
            Sistema Online
          </span>
        </div>
      </div>

      {(expiredIngredients.length > 0 || expiringIngredients.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiredIngredients.length > 0 && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-4 shadow-sm">
              <div className="bg-red-500 p-2 rounded-xl text-white shadow-lg shadow-red-100">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black text-red-800 uppercase tracking-tight">
                  Produtos Vencidos!
                </h4>
                <p className="text-[10px] text-red-600/80 font-bold leading-tight mt-0.5">
                  Existem {expiredIngredients.length} itens no estoque fora do
                  prazo de validade. Remova-os imediatamente do uso.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {expiredIngredients.slice(0, 3).map((i) => (
                    <span
                      key={i.id}
                      className="text-[9px] font-black bg-white px-2 py-0.5 rounded border border-red-200 text-red-600 uppercase italic shadow-sm"
                    >
                      {i.name}
                    </span>
                  ))}
                  {expiredIngredients.length > 3 && (
                    <span className="text-[9px] font-black text-red-400">
                      +{expiredIngredients.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {expiringIngredients.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-4 shadow-sm">
              <div className="bg-amber-500 p-2 rounded-xl text-white shadow-lg shadow-amber-100">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-800 uppercase tracking-tight">
                  Próximos ao Vencimento
                </h4>
                <p className="text-[10px] text-amber-600/80 font-bold leading-tight mt-0.5">
                  {expiringIngredients.length} itens vencerão nos próximos 15
                  dias. Priorize o uso destes produtos.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {expiringIngredients.slice(0, 3).map((i) => (
                    <span
                      key={i.id}
                      className="text-[9px] font-black bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-600 uppercase italic shadow-sm"
                    >
                      {i.name}
                    </span>
                  ))}
                  {expiringIngredients.length > 3 && (
                    <span className="text-[9px] font-black text-amber-400">
                      +{expiringIngredients.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Valor em Estoque"
          value={formatCurrency(totalStockValue)}
          icon={DollarSign}
          accent="bg-indigo-500"
        />
        <StatCard
          title="Insumos Críticos"
          value={lowStock.length.toString()}
          icon={AlertTriangle}
          accent="bg-amber-500"
          isAlert={lowStock.length > 0}
        />
        <StatCard
          title="Vendas de Hoje"
          value={todaySalesCount.toString()}
          icon={TrendingUp}
          accent="bg-emerald-500"
        />
        <StatCard
          title="Movimentações Hoje"
          value={todayMovementsCount.toString()}
          icon={Activity}
          accent="bg-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Low Stock Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" /> Alertas
              Críticos de Reposição
            </h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">
              Ação Corretiva
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 whitespace-nowrap uppercase font-black tracking-wider">
                <tr>
                  <th className="px-6 py-4">Insumo</th>
                  <th className="px-6 py-4">Saldo Atual</th>
                  <th className="px-6 py-4">Estoque Mínimo</th>
                  <th className="px-6 py-4">Acuracidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStock.length > 0 ? (
                  lowStock.map((item) => {
                    const isZeroOrNegative = item.currentStock <= 0;
                    const rowClass = isZeroOrNegative
                      ? "bg-red-50/80 hover:bg-red-100/80 transition-colors"
                      : "bg-amber-50/80 hover:bg-amber-100/80 transition-colors";

                    return (
                      <tr key={item.id} className={rowClass}>
                        <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                          <AlertTriangle
                            size={14}
                            className={
                              isZeroOrNegative
                                ? "text-red-500"
                                : "text-amber-500"
                            }
                          />
                          {item.name}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4 font-mono font-bold underline decoration-slate-200",
                            isZeroOrNegative
                              ? "text-red-700"
                              : "text-amber-700",
                          )}
                        >
                          {item.unit === "un"
                            ? item.currentStock?.toFixed(0).padStart(2, "0")
                            : item.currentStock
                                ?.toFixed(2)
                                .replace(".", ",")}{" "}
                          {item.unit}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">
                          {item.unit === "un"
                            ? item.minStock?.toFixed(0).padStart(2, "0")
                            : item.minStock?.toFixed(2).replace(".", ",")}{" "}
                          {item.unit}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white/50 h-1.5 rounded-full overflow-hidden min-w-[60px] border border-slate-200/50">
                              <div
                                className={cn(
                                  "h-full",
                                  isZeroOrNegative
                                    ? "bg-red-500"
                                    : "bg-amber-500",
                                )}
                                style={{
                                  width: isZeroOrNegative ? "10%" : "40%",
                                }}
                              ></div>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-bold",
                                isZeroOrNegative
                                  ? "text-red-600"
                                  : "text-amber-600",
                              )}
                            >
                              {isZeroOrNegative ? "ESGOTADO" : "CRÍTICO"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-slate-400 italic font-medium"
                    >
                      Estoque operando em níveis normais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Movements Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ExpiryControlWidget />
          
          <DailyMovementsWidget />

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Status do Servidor
            </h4>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-bold text-slate-700">
                  Firebase Online
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Total: {totalProducts} Insumos
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, accent, isAlert, trend }: any) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">
          {title}
        </p>
        <h4
          className={cn(
            "text-2xl font-black text-slate-800",
            isAlert && "text-amber-600",
          )}
        >
          {value}
        </h4>

        {trend && (
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className={cn(
                "flex items-center text-[10px] font-black uppercase px-1.5 py-0.5 rounded",
                trend.isUp
                  ? "bg-red-50 text-red-600"
                  : "bg-emerald-50 text-emerald-600",
              )}
            >
              {trend.isUp ? (
                <ArrowUpRight size={12} strokeWidth={3} />
              ) : (
                <ArrowDownRight size={12} strokeWidth={3} />
              )}
              {trend.value}
            </div>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
              {trend.label}
            </span>
          </div>
        )}

        <div
          className={cn(
            "h-1 w-full mt-3 rounded-full overflow-hidden bg-slate-100",
          )}
        >
          <div
            className={cn("h-full transition-all duration-1000", accent)}
            style={{ width: "70%" }}
          ></div>
        </div>
      </div>
      <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={32} />
      </div>
    </div>
  );
}
