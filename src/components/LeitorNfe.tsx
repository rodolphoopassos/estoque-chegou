import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Loader2, AlertTriangle, ImageIcon } from 'lucide-react';
import { processarNotaFiscal } from '../services/geminiService';

interface LeitorNfeProps {
  onClose: () => void;
  onRead: (data: any) => void;
}

export default function LeitorNfe({ onClose, onRead }: LeitorNfeProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Mostrar preview da imagem
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setError(null);
    setLoading(true);

    try {
      const data = await processarNotaFiscal(file);
      
      if (!data.itens || data.itens.length === 0) {
        setError("A IA não conseguiu identificar itens nesta imagem. Tente com uma foto mais nítida ou de outro ângulo.");
        setLoading(false);
        return;
      }

      onRead(data);
    } catch (err: any) {
      console.error("Erro ao processar NF-e:", err);
      const msg = err?.message || '';
      
      if (msg.includes('GEMINI_API_KEY')) {
        setError("Chave da API Gemini não configurada no servidor. Configure a variável GEMINI_API_KEY no arquivo .env");
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError("Erro de conexão com o servidor. Verifique se o servidor está rodando.");
      } else {
        setError(msg || "Não foi possível ler a nota fiscal. Verifique se a imagem está nítida e tente novamente.");
      }
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRetry = () => {
    setError(null);
    setPreview(null);
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
            <Camera className="text-indigo-600" size={18} />
            Leitor de Nota Fiscal
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              {preview && (
                <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-indigo-200 mb-4 shadow-lg">
                  <img src={preview} alt="Cupom" className="w-full h-full object-cover" />
                </div>
              )}
              <Loader2 size={40} className="text-indigo-600 animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-700">Lendo Cupom Fiscal...</p>
              <p className="text-xs text-slate-500 text-center mt-2 px-4">
                Nossa IA está extraindo os itens. Isso pode demorar alguns segundos.
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-4">
              {preview && (
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-red-200 mb-4 opacity-60">
                  <img src={preview} alt="Cupom" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 w-full mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700 mb-1">Falha na Leitura</p>
                    <p className="text-xs text-red-600 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Camera size={16} /> Tentar Novamente
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleCapture}
                className="hidden"
                id="camera-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-indigo-50 border-2 border-indigo-200 border-dashed hover:bg-indigo-100 hover:border-indigo-300 transition-colors rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-indigo-700"
              >
                <div className="bg-white p-3 rounded-full shadow-sm text-indigo-600">
                  <Camera size={24} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm uppercase tracking-widest">Tirar Foto ou Escolher Imagem</p>
                  <p className="text-xs font-medium text-indigo-500 mt-1">A IA do Gemini extrairá os produtos automaticamente.</p>
                </div>
              </button>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Dicas para melhor resultado:</p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    Centralize o cupom/nota na foto
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    Garanta boa iluminação e foco
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    Inclua todos os itens visíveis na imagem
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
