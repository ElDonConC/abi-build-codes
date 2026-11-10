import React, { useState } from 'react';
import { Copy, Check, Heart, ExternalLink, Calendar, AlertCircle, AlertTriangle, EyeOff } from 'lucide-react';

export default function BuildCard({ build, isFav, onToggleFav, onOpenReport, moderation }) {
  const [copied, setCopied] = useState(false);

  const isOculta = moderation?.estado === 'oculta';
  const hasWarning = moderation?.estado === 'advertencia';
  const codigoEfectivo = moderation?.codigo_reemplazo || build.codigo;

  const handleCopy = () => {
    if (!codigoEfectivo) return;
    navigator.clipboard.writeText(codigoEfectivo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const levelColor = {
    'Económica': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Intermedia': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Premium': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  }[build.nivel] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  const priceFormatted = build.precio_ref 
    ? new Intl.NumberFormat('es-CL').format(build.precio_ref) + ' Koen'
    : 'Sin precio';

  const fechaClean = (build.fecha || '').replace('Agregado automáticamente · ', '');

  return (
    <article className={`group relative rounded-xl border transition-all duration-200 p-4 sm:p-5 shadow-lg shadow-black/40 ${
      hasWarning 
        ? 'border-amber-500/40 bg-[#171412]/80 hover:border-amber-500/70' 
        : isOculta 
        ? 'border-rose-500/30 bg-[#160f12]/60 opacity-60'
        : 'border-white/8 bg-[#10151e]/70 backdrop-blur-md hover:border-amber-500/30 hover:bg-[#141b27]/90 hover:-translate-y-0.5'
    }`}>
      {/* Moderation Banner if flagged */}
      {hasWarning && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 flex-none text-amber-400" />
            <span>{moderation.motivo || 'Reportado: posible código caducado o inconsistente'}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
            En Revisión
          </span>
        </div>
      )}

      {isOculta && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5 font-medium">
          <EyeOff className="w-4 h-4 flex-none text-rose-400" />
          <span>Build desactivada por moderación ({moderation.motivo || 'Código inválido'})</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onToggleFav(build.id)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isFav 
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' 
                : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
            }`}
            title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-400' : ''}`} />
          </button>
          <h3 className="text-base font-bold text-white tracking-wide group-hover:text-amber-400 transition-colors">
            {build.arma}
          </h3>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            {build.clase}
          </span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${levelColor}`}>
            {build.nivel}
          </span>
          {build.etiqueta && (
            <span className="text-xs text-slate-300 font-medium">
              {build.etiqueta}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {fechaClean && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/5">
              <Calendar className="w-3 h-3 text-slate-400" />
              {fechaClean}
            </span>
          )}
          <button
            onClick={() => onOpenReport(build)}
            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            title="Reportar código o error"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-white/5 text-xs">
        {/* Code Box */}
        <div className="sm:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Código Modificación
            </span>
            {moderation?.codigo_reemplazo && (
              <span className="text-[10px] font-bold text-emerald-400">
                Reemplazo oficial
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 bg-[#080b10] border border-white/10 rounded-lg p-2 font-mono">
            <span className="text-sky-300 truncate font-semibold select-all text-[11.5px]">
              {codigoEfectivo}
            </span>
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-md flex-none transition-all flex items-center gap-1 font-sans text-[11px] font-bold cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-slate-950 font-bold' 
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
              }`}
              title="Copiar código para el juego"
            >
              {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Price */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Costo de Referencia
          </span>
          <div className="text-base font-black text-amber-400 font-mono">
            {priceFormatted}
          </div>
          {build.precio_min && build.precio_max && build.precio_min !== build.precio_max && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              Rango: {new Intl.NumberFormat('es-CL').format(build.precio_min)} - {new Intl.NumberFormat('es-CL').format(build.precio_max)}
            </div>
          )}
        </div>

        {/* Source */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Fuente Verificada
          </span>
          {build.url_fuente ? (
            <a
              href={build.url_fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium truncate max-w-full"
            >
              <span className="truncate">{build.fuente || 'Ver fuente original'}</span>
              <ExternalLink className="w-3 h-3 flex-none" />
            </a>
          ) : (
            <span className="text-slate-400">{build.fuente || 'Comunitaria'}</span>
          )}
          {build.notas && (
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-1" title={build.notas}>
              {build.notas}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
