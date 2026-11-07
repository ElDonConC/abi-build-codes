import React, { useState } from 'react';
import { supabase } from '../supabase';
import { X, Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'update_password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        if (onAuthSuccess) onAuthSuccess(data.user);
        onClose();
      } else if (mode === 'register') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
        setMessage('¡Registro iniciado! Revisa tu correo electrónico para confirmar tu cuenta.');
      } else if (mode === 'forgot') {
        // Obtenemos la URL de producción actual limpia
        const currentUrl = window.location.href.split('#')[0];
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: currentUrl,
        });
        if (err) throw err;
        setMessage('Se ha enviado un nuevo enlace de recuperación a tu correo electrónico.');
      } else if (mode === 'update_password') {
        const { data, error: err } = await supabase.auth.updateUser({
          password: password,
        });
        if (err) throw err;
        setMessage('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.');
        setTimeout(() => {
          setMode('login');
          setMessage(null);
        }, 2000);
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0f141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-amber-400/10 border border-amber-400/30 text-amber-400 uppercase mb-2">
            Identificación Táctica
          </div>
          <h2 className="text-xl font-black tracking-wide text-white">
            {mode === 'login' && 'Iniciar Sesión'}
            {mode === 'register' && 'Crear Cuenta de Operador'}
            {mode === 'forgot' && 'Recuperar Contraseña'}
            {mode === 'update_password' && 'Establecer Nueva Contraseña'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login' && 'Accede a tus builds guardadas y favoritos en la nube.'}
            {mode === 'register' && 'Regístrate para guardar y sincronizar tu equipamiento.'}
            {mode === 'forgot' && 'Te enviaremos un correo para restablecer tu clave.'}
            {mode === 'update_password' && 'Introduce tu nueva contraseña segura.'}
          </p>
        </div>

        {/* Notifications */}
        {message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 flex-none" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-none" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'update_password' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@ejemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {mode === 'update_password' ? 'Nueva Contraseña' : 'Contraseña'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
                    className="text-xs text-amber-400/90 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-amber-400/10 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <span>Procesando...</span>
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Entrar al Sistema'}
                  {mode === 'register' && 'Registrar Operador'}
                  {mode === 'forgot' && 'Enviar Correo de Recuperación'}
                  {mode === 'update_password' && 'Guardar Nueva Contraseña'}
                </span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-slate-400">
          {mode === 'login' && (
            <p>
              ¿No tienes una cuenta?{' '}
              <button
                onClick={() => { setMode('register'); setError(null); setMessage(null); }}
                className="font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Regístrate aquí
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p>
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                className="font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Inicia sesión
              </button>
            </p>
          )}
          {(mode === 'forgot' || mode === 'update_password') && (
            <button
              onClick={() => { setMode('login'); setError(null); setMessage(null); }}
              className="font-bold text-amber-400 hover:underline cursor-pointer"
            >
              ← Volver al inicio de sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
