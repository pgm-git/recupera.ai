import React, { useState } from 'react';
import { User, Mail, Phone, Key, Save, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const Profile: React.FC = () => {
  const { profile, updatePassword } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const apiKey = (profile as any)?.apiKey || 'demo-api-key-placeholder';

  const handleSaveProfile = async () => {
    if (!profile || !isSupabaseConfigured()) {
      addToast('info', 'Modo demo — alterações não são salvas');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ name })
        .eq('id', profile.id);
      if (error) throw error;
      addToast('success', 'Perfil atualizado com sucesso');
    } catch {
      addToast('error', 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      addToast('warning', 'Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('warning', 'As senhas não coincidem');
      return;
    }
    const { error } = await updatePassword(newPassword);
    if (error) {
      addToast('error', error);
    } else {
      addToast('success', 'Senha alterada com sucesso');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
        <p className="text-slate-500 mt-1">Gerencie suas informações pessoais e segurança.</p>
      </div>

      {/* Profile Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <User size={20} className="text-brand-600" />
          Informações Pessoais
        </h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
            <Mail size={16} />
            <span>{profile?.email || 'email@example.com'}</span>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {/* API Key */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Key size={20} className="text-purple-600" />
          Chave de API
        </h3>
        <p className="text-sm text-slate-500">Use esta chave para autenticar chamadas de API externas.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-600">
            {showApiKey ? apiKey : '••••••••••••••••••••'}
          </div>
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
            aria-label={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
          >
            {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button
            onClick={handleCopyApiKey}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
            aria-label="Copiar chave"
          >
            {apiKeyCopied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Alterar Senha</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <button
          onClick={handleChangePassword}
          disabled={!newPassword || !confirmPassword}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Alterar Senha
        </button>
      </div>

      {/* Plan Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Plano Atual</h3>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm font-medium">MVP</span>
          <span className="text-sm text-slate-500">Plano de teste — funcionalidades completas</span>
        </div>
      </div>
    </div>
  );
};

export default Profile;
