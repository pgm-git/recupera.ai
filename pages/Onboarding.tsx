import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Smartphone, Package, Link, TestTube, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';
import QRModal from '../components/QRModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';

interface Step {
  title: string;
  description: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  { title: 'Bem-vindo ao Recupera.AI', description: 'Recupere vendas abandonadas com IA + WhatsApp.', icon: CheckCircle },
  { title: 'Conectar WhatsApp', description: 'Escaneie o QR Code para conectar sua instância.', icon: Smartphone },
  { title: 'Configurar Produto', description: 'Adicione seu primeiro produto para monitorar.', icon: Package },
  { title: 'Configurar Webhook', description: 'Configure o webhook na sua plataforma de vendas.', icon: Link },
  { title: 'Testar Pipeline', description: 'Envie um lead teste para validar o fluxo completo.', icon: TestTube },
];

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const markComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const handleNext = () => {
    markComplete(currentStep);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      addToast('success', 'Onboarding completo! Bem-vindo ao Recupera.AI');
      navigate('/');
    }
  };

  const handleSkip = () => {
    addToast('info', 'Você pode completar o setup em Configurações');
    navigate('/');
  };

  const webhookUrl = `https://api.recupa.ai/api/webhooks/${profile?.id || 'SEU_ID'}`;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Progress */}
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  completedSteps.has(idx)
                    ? 'bg-emerald-500 text-white'
                    : idx === currentStep
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {completedSteps.has(idx) ? <CheckCircle size={18} /> : idx + 1}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 hidden sm:block">{step.title.split(' ').slice(0, 2).join(' ')}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {React.createElement(steps[currentStep].icon, { size: 28, className: 'text-brand-600' })}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{steps[currentStep].title}</h2>
          <p className="text-slate-500 mt-2">{steps[currentStep].description}</p>
        </div>

        {/* Step-specific content */}
        {currentStep === 0 && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              O Recupera.AI monitora abandonos de carrinho e envia mensagens personalizadas via WhatsApp usando IA.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { label: 'Webhook', desc: 'Receba eventos de abandono' },
                { label: 'IA', desc: 'Gere mensagens personalizadas' },
                { label: 'WhatsApp', desc: 'Envie automaticamente' },
              ].map(item => (
                <div key={item.label} className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="text-center">
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Smartphone size={18} className="inline mr-2" />
              Conectar WhatsApp
            </button>
            <p className="text-xs text-slate-400 mt-3">Você também pode fazer isso depois em Configurações.</p>
          </div>
        )}

        {currentStep === 2 && (
          <div className="text-center">
            <button
              onClick={() => {
                markComplete(2);
                navigate('/products');
              }}
              className="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
            >
              <Package size={18} className="inline mr-2" />
              Ir para Produtos
            </button>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 text-center">
              Copie a URL abaixo e configure como webhook de "Abandono de Carrinho" na sua plataforma:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <code className="text-sm text-slate-700 font-mono break-all">{webhookUrl}</code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                addToast('success', 'URL copiada!');
              }}
              className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
            >
              Copiar URL
            </button>
          </div>
        )}

        {currentStep === 4 && (
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-600">
              Simule um abandono de carrinho na sua plataforma para verificar se o webhook está funcionando.
            </p>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-700">
                Quando receber uma mensagem no WhatsApp conectado, o pipeline está funcionando!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
        >
          <ArrowLeft size={16} />
          Anterior
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <SkipForward size={16} />
            Pular
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            {currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <QRModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />
    </div>
  );
};

export default Onboarding;
