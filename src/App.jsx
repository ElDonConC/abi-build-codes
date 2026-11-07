import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header.jsx';
import BuildCard from './components/BuildCard.jsx';
import WeaponCard from './components/WeaponCard.jsx';
import AuthModal from './components/AuthModal.jsx';
import ReportModal from './components/ReportModal.jsx';
import AdminReports from './components/AdminReports.jsx';
import { supabase } from './supabase.js';
import { Search, Heart, Layers, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';

export default function App() {
  const [tab, setTab] = useState('builds');
  const [builds, setBuilds] = useState([]);
  const [armas, setArmas] = useState([]);
  const [imgs, setImgs] = useState({});
  const [monitor, setMonitor] = useState(null);
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('login');

  // Report modal state
  const [reportingBuild, setReportingBuild] = useState(null);

  // Favorites
  const [favs, setFavs] = useState(() => {
    try {
      const saved = localStorage.getItem('abi_favs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClase, setSelectedClase] = useState('');
  const [selectedNivel, setSelectedNivel] = useState('');
  const [selectedWeapon, setSelectedWeapon] = useState('');
  const [sortOrder, setSortOrder] = useState('recientes');

  // Supabase Auth listener & Recovery Token Handler
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setAuthInitialMode('update_password');
        setIsAuthOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hash listener for direct #admin link
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin' || window.location.hash === '#reportes') {
        setTab('admin');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Load Data
  useEffect(() => {
    async function loadData() {
      try {
        const [buildsRes, armasRes, imgRes, monRes] = await Promise.all([
          fetch('./data/builds.json').then(r => r.json()),
          fetch('./data/armas.json').then(r => r.json()),
          fetch('./data/img.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
          fetch('./data/monitor.json').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        setBuilds(buildsRes || []);
        setArmas(armasRes || []);
        setImgs(imgRes || {});
        setMonitor(monRes);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    }
    loadData();
  }, []);

  const toggleFav = (id) => {
    setFavs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('abi_favs', JSON.stringify(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Classes & Levels dropdowns
  const clasesList = useMemo(() => {
    const s = new Set(builds.map(b => b.clase).filter(Boolean));
    return Array.from(s).sort();
  }, [builds]);

  const nivelesList = useMemo(() => {
    const s = new Set(builds.map(b => b.nivel).filter(Boolean));
    return Array.from(s).sort();
  }, [builds]);

  // Date parsing helper
  const parseDate = (str) => {
    if (!str) return '0000-00-00';
    const mIso = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    return '0000-00-00';
  };

  // Filtered builds
  const filteredBuilds = useMemo(() => {
    let list = builds.filter(b => {
      if (tab === 'favoritos' && !favs.includes(b.id)) return false;
      if (selectedWeapon && b.arma !== selectedWeapon) return false;
      if (selectedClase && b.clase !== selectedClase) return false;
      if (selectedNivel && b.nivel !== selectedNivel) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = 
          b.arma.toLowerCase().includes(q) ||
          (b.codigo || '').toLowerCase().includes(q) ||
          (b.etiqueta || '').toLowerCase().includes(q) ||
          (b.fuente || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortOrder === 'recientes') {
        const da = parseDate(a.fecha);
        const db = parseDate(b.fecha);
        if (da !== db) return db.localeCompare(da);
      }
      if (sortOrder === 'precio_asc') {
        return (a.precio_ref || 9999999) - (b.precio_ref || 9999999);
      }
      if (sortOrder === 'precio_desc') {
        return (b.precio_ref || 0) - (a.precio_ref || 0);
      }
      return a.arma.localeCompare(b.arma);
    });

    return list;
  }, [builds, tab, favs, selectedWeapon, selectedClase, selectedNivel, search, sortOrder]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        stats={{
          builds: builds.length,
          armas: armas.length,
          verif: monitor?.resumen?.codigos_presentes ? `${monitor.resumen.codigos_presentes}/${builds.length}` : '—',
        }}
        updatedAt={monitor?.updated_at ? monitor.updated_at.slice(0, 10) : ''}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Tabs */}
      <div className="border-b border-white/10 bg-[#0a0e14]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto py-2.5">
          <button
            onClick={() => { setTab('builds'); window.location.hash = ''; }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'builds'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Builds Activas ({builds.length})
          </button>

          <button
            onClick={() => { setTab('favoritos'); window.location.hash = ''; }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'favoritos'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Favoritos ({favs.length})
          </button>

          <button
            onClick={() => { setTab('armas'); window.location.hash = ''; }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'armas'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Índice de Armas ({armas.length})
          </button>

          {/* Admin Tab (visible if logged in or viewing #admin) */}
          {(user || tab === 'admin') && (
            <button
              onClick={() => { setTab('admin'); window.location.hash = '#admin'; }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                tab === 'admin'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-400/10'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Gestión Reportes
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* Filter Toolbar */}
        {(tab === 'builds' || tab === 'favoritos') && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar arma, código, fuente, accesorio..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <select
                value={selectedClase}
                onChange={e => setSelectedClase(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="">Todas las clases</option>
                {clasesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={selectedNivel}
                onChange={e => setSelectedNivel(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="">Todos los niveles</option>
                {nivelesList.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="recientes">Más recientes primero</option>
                <option value="arma">Orden por arma (A-Z)</option>
                <option value="precio_asc">Precio: menor a mayor</option>
                <option value="precio_desc">Precio: mayor a menor</option>
              </select>
            </div>

            {selectedWeapon && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filtrando por:</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 border border-amber-400/30 text-amber-400">
                  {selectedWeapon}
                  <button
                    onClick={() => setSelectedWeapon('')}
                    className="hover:text-white font-black cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tab Views */}
        {tab === 'builds' || tab === 'favoritos' ? (
          <div>
            <div className="text-xs text-slate-400 font-medium mb-3">
              Mostrando {filteredBuilds.length} de {builds.length} configuraciones tácticas
            </div>
            {filteredBuilds.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-white/10 rounded-2xl">
                {tab === 'favoritos' 
                  ? 'Aún no has guardado ninguna build favorita. Pulsa el corazón ♥ en cualquier tarjeta para añadirla.'
                  : 'No se encontraron builds con los filtros seleccionados.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredBuilds.map(b => (
                  <BuildCard
                    key={b.id}
                    build={b}
                    isFav={favs.includes(b.id)}
                    onToggleFav={toggleFav}
                    onOpenReport={setReportingBuild}
                  />
                ))}
              </div>
            )}
          </div>
        ) : tab === 'armas' ? (
          <div>
            <div className="text-xs text-slate-400 font-medium mb-3">
              Catálogo de {armas.length} armas registradas en Season 7
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {armas.map(a => {
                const count = builds.filter(b => b.arma === a.arma).length;
                return (
                  <WeaponCard
                    key={a.id}
                    arma={a}
                    imgRel={imgs[a.arma]}
                    buildsCount={count}
                    onSelectWeapon={armaName => {
                      setSelectedWeapon(armaName);
                      setTab('builds');
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          /* Admin View */
          <div>
            {!user ? (
              <div className="max-w-md mx-auto text-center py-16 px-4 border border-dashed border-white/10 rounded-2xl bg-[#0f141c]">
                <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Acceso Administrativo Requerido</h3>
                <p className="text-xs text-slate-400 mb-5">
                  Debes iniciar sesión con tu cuenta de administrador de Supabase para revisar y gestionar los reportes.
                </p>
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-400/10"
                >
                  Iniciar Sesión como Admin
                </button>
              </div>
            ) : (
              <AdminReports user={user} />
            )}
          </div>
        )}
      </main>

      {/* Tactical Footer */}
      <footer className="border-t border-white/10 bg-[#080b10] py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-400">
            ABI ARMORY — Plataforma Táctica de Arena Breakout: Infinite · <a href="#admin" onClick={() => setTab('admin')} className="text-amber-400 hover:underline">Acceso Admin</a>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Arena Breakout: Infinite es marca registrada de Morefun Studios / Tencent Games. Proyecto comunitario independiente.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authInitialMode}
        onClose={() => { setIsAuthOpen(false); setAuthInitialMode('login'); }}
        onAuthSuccess={(u) => setUser(u)}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportingBuild}
        onClose={() => setReportingBuild(null)}
        build={reportingBuild}
      />
    </div>
  );
}
