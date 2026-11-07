import React from 'react';
import { Crosshair, ShieldCheck, Zap } from 'lucide-react';

export default function Header({ stats, updatedAt }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090e]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1c2533] to-[#0c1017] border border-amber-500/40 flex items-center justify-center shadow-lg shadow-black/50 text-amber-400">
            <Crosshair className="w-6 h-6 stroke-[2.2] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-wider text-white">
                ABI <span className="text-amber-400">ARMORY</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                S7 Live
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Base de datos táctica & códigos de modificación · Arena Breakout: Infinite
            </p>
            {updatedAt && (
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Sincronizado: <b className="text-slate-200">{updatedAt}</b> · Monitor continuo
              </p>
            )}
          </div>
        </div>

        {/* Global Quick Stats */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Builds</div>
            <div className="text-lg font-black text-amber-400 font-mono">{stats.builds || '—'}</div>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Armas</div>
            <div className="text-lg font-black text-white font-mono">{stats.armas || '—'}</div>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verificadas</div>
            <div className="text-lg font-black text-emerald-400 font-mono">{stats.verif || '—'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
