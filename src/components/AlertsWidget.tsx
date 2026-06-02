import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Settings, Bell, BellOff, X } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { motion, AnimatePresence } from 'framer-motion';

const playAlertSound = (level: 'warning' | 'critical') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (level === 'critical') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch(e) {
    console.error("Could not play audio", e);
  }
};

export default function AlertsWidget({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const { ingredients } = useInventory();
  const [showConfig, setShowConfig] = useState(false);
  
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('inventory_alerts_config');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      warningDays: 3,
      criticalPercentage: 10 // Consider critical if stock is below 10% of minStock, or simply use 0.
    };
  });

  const saveConfig = (newConfig: any) => {
    setConfig(newConfig);
    localStorage.setItem('inventory_alerts_config', JSON.stringify(newConfig));
  };

  const { lowCount, expiredCount, expiringCount, totalAlerts, itemsDetails } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to start of day

    let lowCount = 0;
    let expiredCount = 0;
    let expiringCount = 0;

    const details: any[] = [];

    ingredients.forEach(i => {
      // Stock Checks
      const current = Number(i.currentStock);
      const min = Number(i.minStock);
      
      let alertRegistered = false;

      if (current <= min) {
          lowCount++;
          details.push({ name: i.name, type: 'Estoque Baixo' });
          alertRegistered = true;
      }

      // Expiry Checks
      if (i.expiryDate) {
        const expiry = new Date(i.expiryDate);
        expiry.setHours(0,0,0,0);
        
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          expiredCount++;
          if (!alertRegistered) {
              details.push({ name: i.name, type: 'Vencido' });
              alertRegistered = true;
          }
        } else if (diffDays <= config.warningDays) {
          expiringCount++;
          if (!alertRegistered) {
              details.push({ name: i.name, type: `Vence em ${diffDays}d` });
          }
        }
      }
    });

    return {
      lowCount,
      expiredCount,
      expiringCount,
      totalAlerts: lowCount + expiredCount + expiringCount,
      itemsDetails: details.slice(0, 3) // Preview up to 3 items
    };
  }, [ingredients, config.warningDays]);

  const prevAlertsRef = useRef({ low: 0, expired: 0, expiring: 0 });

  useEffect(() => {
    // Only trigger sound if the count INCREASES (new alert)
    const prev = prevAlertsRef.current;
    
    if (config.soundEnabled) {
      if (lowCount > prev.low || expiredCount > prev.expired) {
        playAlertSound('critical');
      } else if (expiringCount > prev.expiring) {
        playAlertSound('warning');
      }
    }

    prevAlertsRef.current = { low: lowCount, expired: expiredCount, expiring: expiringCount };
  }, [lowCount, expiredCount, expiringCount, config.soundEnabled]);

  let alertMessage = "Estoque OK";
  let alertDetails = "Nenhum alerta crítico encontrado.";
  let alertLevel: "success" | "warning" | "critical" = "success";

  if (totalAlerts > 0) {
    if (lowCount > 0 || expiredCount > 0) {
        alertLevel = "critical";
        alertMessage = "Estoque Crítico";
        const parts = [];
        if (lowCount > 0) parts.push(`${lowCount} com estoque baixo`);
        if (expiredCount > 0) parts.push(`${expiredCount} vencido(s)`);
        alertDetails = parts.join(' • ');
    } else {
        alertLevel = "warning";
        alertMessage = "Atenção (Validade)";
        alertDetails = `${expiringCount} vencendo em breve.`;
    }
  }

  const bgClasses = {
      success: "bg-emerald-50 border-emerald-200",
      warning: "bg-amber-50 border-amber-200",
      critical: "bg-red-50 border-red-200",
      criticalPulse: "ring-2 ring-red-400 ring-offset-2 animate-pulse"
  };

  const iconClasses = {
      success: "text-emerald-600",
      warning: "text-amber-600",
      critical: "text-red-600" // animation handled via framer-motion below
  };

  const titleClasses = {
      success: "text-emerald-700",
      warning: "text-amber-700",
      critical: "text-red-700"
  };

  const descClasses = {
      success: "text-emerald-600",
      warning: "text-amber-600",
      critical: "text-red-600 font-medium"
  };

  // Critical items get extra visual priority
  const isCritical = alertLevel === 'critical';
  
  return (
    <div className="relative">
      <motion.div 
        animate={isCritical ? { scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } } : {}}
        className={`rounded-xl border p-4 shadow-sm transition-all relative overflow-hidden group ${bgClasses[alertLevel]} ${isCritical ? 'border-red-300' : ''}`}
      >
        {isCritical && (
            <div className="absolute inset-0 bg-red-400 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
        )}
        
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                {totalAlerts > 0 ? (
                    <motion.div animate={isCritical ? { rotate: [0, -10, 10, -10, 10, 0] } : {}} transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}>
                         <AlertTriangle size={14} className={iconClasses[alertLevel]} />
                    </motion.div>
                ) : (
                    <CheckCircle2 size={14} className={iconClasses[alertLevel]} />
                )}
                <p className={`text-[10px] font-bold uppercase tracking-widest ${iconClasses[alertLevel]}`}>
                    Alertas
                </p>
            </div>
            {isSidebarOpen && (
                <button 
                  onClick={() => setShowConfig(true)}
                  className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/5 ${iconClasses[alertLevel]}`}
                >
                  <Settings size={14} />
                </button>
            )}
        </div>
        
        {isSidebarOpen ? (
          <div>
            <p className={`text-lg font-black leading-tight uppercase tracking-wide ${titleClasses[alertLevel]}`}>{alertMessage}</p>
            <p className={`text-xs mt-1 leading-snug ${descClasses[alertLevel]}`}>{alertDetails}</p>
            
            {totalAlerts > 0 && itemsDetails.length > 0 && (
                <div className="mt-3 pt-3 border-t border-black/5 flex flex-col gap-1">
                    {itemsDetails.map((detail, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                            <span className={`truncate mr-2 ${titleClasses[alertLevel]} opacity-80 uppercase tracking-widest`}>{detail.name}</span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-sm ${isCritical ? 'bg-red-100' : 'bg-amber-100'} ${titleClasses[alertLevel]}`}>
                                {detail.type}
                            </span>
                        </div>
                    ))}
                    {totalAlerts > itemsDetails.length && (
                        <div className={`text-[10px] text-center mt-1 font-bold uppercase tracking-widest opacity-60 ${titleClasses[alertLevel]}`}>
                            + {totalAlerts - itemsDetails.length} outro(s)
                        </div>
                    )}
                </div>
            )}
          </div>
        ) : (
          <p className={`text-sm font-black text-center ${titleClasses[alertLevel]}`}>
              {totalAlerts > 0 ? "!!!" : "OK"}
          </p>
        )}
      </motion.div>

      <AnimatePresence>
        {showConfig && isSidebarOpen && (
            <motion.div 
               initial={{ opacity: 0, y: 10, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: 10, scale: 0.95 }}
               className="absolute z-50 top-full mt-2 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-4 flex flex-col gap-4 text-slate-700"
            >
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-800">Cnf Alertas</span>
                    <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-slate-50"><X size={14}/></button>
                </div>
                
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notificação Sonora</span>
                    <button 
                        onClick={() => saveConfig({...config, soundEnabled: !config.soundEnabled})}
                        className={`p-1.5 rounded-lg transition-colors ${config.soundEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                        {config.soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dias para alerta de Vencimento</label>
                    <div className="flex items-center justify-between gap-3">
                        <input 
                            type="range" 
                            min="1" 
                            max="15" 
                            value={config.warningDays}
                            onChange={(e) => saveConfig({...config, warningDays: Number(e.target.value)})}
                            className="flex-1 accent-indigo-600"
                        />
                        <span className="text-xs font-black w-8 text-right text-indigo-600">{config.warningDays}d</span>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

