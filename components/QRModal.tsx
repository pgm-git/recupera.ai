import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { connectInstance, checkInstanceStatus } from '../services/apiService';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, productId }) => {
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'scanned' | 'connected'>('waiting');
  const [imgError, setImgError] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const doConnect = (productIdToConnect: string) => {
    setLoading(true);
    setError(null);
    setImgError(false);
    setQrCode(null);

    connectInstance(productIdToConnect).then((data) => {
      console.log('[QRModal] connectInstance response:', {
        hasQrCode: !!data.qrCodeBase64,
        qrLen: data.qrCodeBase64?.length || 0,
        qrPrefix: data.qrCodeBase64?.substring(0, 40),
        status: data.status,
      });

      const qr = data.qrCodeBase64;

      if (!qr) {
        setError('QR Code não retornado pela UAZAPI. Verifique se a instância está configurada corretamente.');
        setLoading(false);
        return;
      }

      // Ensure the QR code is a valid data URI for img rendering
      let qrSrc = qr;
      if (!qr.startsWith('data:')) {
        // If UAZAPI returned raw base64 without the data URI prefix, add it
        qrSrc = `data:image/png;base64,${qr}`;
        console.log('[QRModal] Added data URI prefix to QR code');
      }

      setQrCode(qrSrc);
      setLoading(false);

      // Polling: check connection status
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = window.setInterval(async () => {
        try {
          const statusData = await checkInstanceStatus(productIdToConnect);
          if (statusData.status === 'connected') {
            setStatus('connected');
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch (e) {
          console.error('[QRModal] Polling error', e);
        }
      }, 3000);
    }).catch(err => {
      console.error('[QRModal] Connect error:', err);
      setError(`Erro ao conectar: ${err.message || 'Verifique se o servidor está rodando.'}`);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (isOpen && productId) {
      setStatus('waiting');
      doConnect(productId);
    } else {
      setQrCode(null);
      setError(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, productId]);

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
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Falha ao gerar QR Code</h4>
              <p className="text-sm text-slate-500 mb-4 max-w-xs">{error}</p>
              <button
                onClick={() => doConnect(productId)}
                className="px-5 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors"
              >
                Tentar Novamente
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
                ) : imgError ? (
                  <div className="flex flex-col items-center text-amber-600 p-4">
                    <AlertTriangle size={24} className="mb-2" />
                    <span className="text-xs font-medium">Imagem do QR Code inválida</span>
                    <span className="text-xs text-slate-400 mt-1">
                      {qrCode ? `${qrCode.substring(0, 30)}...` : 'vazio'}
                    </span>
                    <button
                      onClick={() => doConnect(productId)}
                      className="mt-3 px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : (
                  <img
                    src={qrCode || ''}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                    onError={() => {
                      console.error('[QRModal] Image failed to load. QR data:', qrCode?.substring(0, 60));
                      setImgError(true);
                    }}
                    onLoad={() => {
                      console.log('[QRModal] QR image loaded successfully');
                    }}
                  />
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
