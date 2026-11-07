import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';

export default function WeaponCard({ arma, imgRel, buildsCount, onSelectWeapon }) {
  const iniciales = (arma.arma.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '??').toUpperCase();

  const priceMin = arma.precio_min 
    ? new Intl.NumberFormat('es-CL').format(arma.precio_min) + ' Koen'
    : 'Sin dato';

  return (
    <article className="rounded-xl border border-white/8 bg-[#10151e]/70 backdrop-blur-md p-4 sm:p-5 hover:border-amber-500/30 hover:bg-[#141b27]/90 transition-all duration-200 shadow-lg shadow-black/40">
      <div className="flex items-start justify-between gap-4">
        {/* Weapon Image or Fallback */}
        <div className="flex items-center gap-3.5">
          <div className="w-24 h-14 rounded-lg bg-slate-950/80 border border-white/10 flex items-center justify-center overflow-hidden flex-none relative">
            {imgRel ? (
              <img
                src={`data/${imgRel}`}
                alt={arma.arma}
                className="w-full h-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <span className="text-slate-400 font-mono font-bold text-sm tracking-wider">
                {iniciales}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {arma.arma}
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {arma.clase}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {buildsCount} {buildsCount === 1 ? 'build disponible' : 'builds disponibles'}
            </p>
          </div>
        </div>

        {/* View Builds Action */}
        <button
          onClick={() => onSelectWeapon(arma.arma)}
          className="px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold hover:bg-amber-400 hover:text-slate-950 transition-all"
        >
          Filtrar Builds →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-white/5 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
            Precio Mínimo
          </span>
          <span className="font-mono font-bold text-slate-200">
            {priceMin}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
            Gama Cubierta
          </span>
          <span className="text-slate-300">
            {arma.cobertura || 'Estándar'}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
            Estado Roster
          </span>
          <span className="text-slate-300 truncate block" title={arma.estado || 'Activa'}>
            {arma.estado || 'Activa en Season 7'}
          </span>
        </div>
      </div>
    </article>
  );
}

