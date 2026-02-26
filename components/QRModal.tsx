import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Smartphone, CheckCircle } from 'lucide-react';
import { connectInstance, checkInstanceStatus } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'scanned' | 'connected'>('waiting');
  const pollingRef = useRef<number | null>(null);
  const { profile } = useAuth();

  const clientId = profile?.id || "user-id-placeholder";

  useEffect(() => {
    let mounted = true;

    if (isOpen) {
      setLoading(true);
      setStatus('waiting');
      
      // 1. Inicia sessão na UAZAPI via backend
      connectInstance(clientId).then((data) => {
        if(mounted && data.qrCodeBase64) {
            setQrCode(data.qrCodeBase64);
            setLoading(false);
            
            // 2. Polling: Verifica status da conexão
            pollingRef.current = window.setInterval(async () => {
                try {
                    const statusData = await checkInstanceStatus(clientId);
                    if (statusData.status === 'connected') {
                        setStatus('connected');
                        if(pollingRef.current) clearInterval(pollingRef.current);
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 3000);
        }
      }).catch(err => {
          console.error("Erro ao conectar", err);
          setLoading(false);
      });
    } else {
        setQrCode(null);
        if(pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
        mounted = false;
        if(pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center">
            <Smartphone size={18} className="mr-2 text-brand-600" />
            Conectar WhatsApp
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          {status === 'connected' ? (
              <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                      <CheckCircle size={40} className="text-emerald-600" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">Conectado com Sucesso!</h4>
                  <p className="text-slate-500 mt-2">Seu WhatsApp está pronto para enviar mensagens de recuperação.</p>
                  <button onClick={onClose} className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium">
                      Fechar
                  </button>
              </div>
          ) : (
            <>
                <p className="text-slate-600 mb-6 text-sm">
                    Escaneie o QR Code abaixo com seu WhatsApp.
                </p>

                <div className="relative w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 mb-6 overflow-hidden">
                    {loading ? (
                    <div className="flex flex-col items-center text-slate-500">
                        <RefreshCw className="animate-spin mb-2 text-brand-500" size={32} />
                        <span className="text-xs font-medium">Gerando Sessão na UAZAPI...</span>
                    </div>
                    ) : (
                        <img src={qrCode || ''} alt="QR Code" className="w-full h-full object-contain" />
                    )}
                </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRModal;