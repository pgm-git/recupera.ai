import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
      >
        <ArrowLeft size={18} />
        Voltar
      </button>

      <h1 className="text-3xl font-bold text-slate-900 mb-8">Politica de Privacidade</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Dados Coletados</h2>
          <p>O Recupera.AI coleta os seguintes dados pessoais (PII) para operar o servico de recuperacao de vendas:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Nome</strong> — identificacao do lead</li>
            <li><strong>Email</strong> — identificacao e comunicacao</li>
            <li><strong>Telefone</strong> — envio de mensagens WhatsApp para recuperacao</li>
            <li><strong>Valor da compra</strong> — metricas de recuperacao</li>
            <li><strong>URL de checkout</strong> — referencia do abandono</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Finalidade do Tratamento</h2>
          <p>Os dados sao coletados exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Envio de mensagens automatizadas de recuperacao de vendas via WhatsApp</li>
            <li>Geracao de conversas com IA (GPT-4o-mini) para recuperacao personalizada</li>
            <li>Metricas e dashboards para o usuario SaaS (cliente)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Base Legal (LGPD)</h2>
          <p>O tratamento de dados e realizado com base no <strong>interesse legitimo</strong> do controlador (Art. 7, IX da LGPD) para recuperacao de vendas abandonadas, combinado com o <strong>consentimento</strong> do titular quando aplicavel.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Retencao de Dados</h2>
          <p>Os dados de leads sao retidos por ate <strong>90 dias</strong> apos a ultima interacao. Dados deletados sao marcados com soft delete e removidos definitivamente apos 30 dias adicionais.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Direitos do Titular</h2>
          <p>Conforme a LGPD (Lei 13.709/2018), o titular dos dados tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Acesso</strong> — solicitar copia de todos os dados armazenados</li>
            <li><strong>Portabilidade</strong> — exportar dados em formato JSON</li>
            <li><strong>Exclusao</strong> — solicitar a remocao de todos os dados pessoais</li>
            <li><strong>Revogacao de consentimento</strong> — optar por nao receber mais mensagens</li>
          </ul>
          <p className="mt-2">Para exercer esses direitos, entre em contato via email ou utilize os endpoints de API disponiveis.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Compartilhamento</h2>
          <p>Os dados sao compartilhados apenas com:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>OpenAI</strong> — para geracao de mensagens (dados anonimizados quando possivel)</li>
            <li><strong>UAZAPI</strong> — para envio de mensagens WhatsApp</li>
            <li><strong>Supabase</strong> — armazenamento de dados (infraestrutura)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Seguranca</h2>
          <p>Implementamos as seguintes medidas de seguranca:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Criptografia em transito (HTTPS/TLS)</li>
            <li>Row Level Security (RLS) no banco de dados</li>
            <li>Autenticacao obrigatoria para acesso a plataforma</li>
            <li>Chaves de API e credenciais em variaveis de ambiente</li>
          </ul>
        </section>

        <div className="border-t border-slate-200 pt-6 mt-8">
          <p className="text-xs text-slate-400">Ultima atualizacao: Fevereiro 2026</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
