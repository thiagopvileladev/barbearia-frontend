import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';

export default function AdminPage() {
  // =========================================================
  // LUGAR ÚNICO PARA MUDAR A COR DE TODO O PAINEL!
  // =========================================================
  const themeHex = "#48C0D0"; 
  
  const themeVars = {
    "--theme-main": themeHex,
    "--theme-5": `${themeHex}0D`,   
    "--theme-10": `${themeHex}1A`,  
    "--theme-20": `${themeHex}33`,  
    "--theme-30": `${themeHex}4D`,  
    "--theme-40": `${themeHex}66`,  
  };

  const tenantId = "f90dcfa6-43ca-4228-8612-db63f5554f17";
  const [isDarkMode, setIsDarkMode] = useState(true); 
  
  // === SISTEMA DE LOGIN (O CRACHÁ DIGITAL E ERRO DE ACESSO) ===
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [authError, setAuthError] = useState(false); // <-- NOVO: Controle do Pop-up de Erro

  const [view, setView] = useState('dashboard');
  const [appointments, setAppointments] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [servicos, setServicos] = useState([]);
  
  const [filtroAgenda, setFiltroAgenda] = useState('hoje');
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos'); 
  const [isBarberDropdownOpen, setIsBarberDropdownOpen] = useState(false); 
  
  const [now, setNow] = useState(new Date());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [formData, setFormData] = useState({ name: '', price: '', duration: '' });

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', id: null });
  const [autoConfirmModal, setAutoConfirmModal] = useState({ isOpen: false, appointment: null });
  const [ignoredAutoConfirms, setIgnoredAutoConfirms] = useState([]);

  const [bulkDeleteModal, setBulkDeleteModal] = useState({ isOpen: false, type: '', item: null, relatedApps: [] });
  const [summaryModal, setSummaryModal] = useState({ isOpen: false, type: '', cancelledApps: [] });
  const [cancelModal, setCancelModal] = useState({ isOpen: false, appointment: null });

  // Configura o Axios para SEMPRE mandar o token se o usuário estiver logado
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchData();
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const COLOR_MAP = {
    'Corte Degrade': '#3b82f6',      
    'Corte Barba': '#8b5cf6',      
    'Corte 1 Pente': '#06b6d4',        
    'Corte e Barba': '#10b981',     
    'Corte Low Fade': '#f59e0b',            
    'Corte Social': '#ef4444',    
    'Depilação Nariz/Ouvido': '#ec4899',           
    'Hidratação': '#eab308',             
    'Pezinho': '#94a3b8',        
    'Pigmentação': '#d946ef',     
    'Realinhamento Capilar': '#64748b',
    "Sobranchelha": "#fff"            
  };

  const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const getBarberPhoto = (name) => {
    if(!name) return '/barbeiros/bonec.jpg';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('rafael')) return '/barbeiros/b1.png';
    if (lowerName.includes('daniel')) return '/barbeiros/b2.png';
    return '/barbeiros/bonec.jpg';
  };

  const fetchData = async () => {
    try {
      const [appRes, barbRes, servRes] = await Promise.all([
        axios.get('https://barbearia-backend-dja2.onrender.com/api/appointments'),
        axios.get('https://barbearia-backend-dja2.onrender.com/api/barbers'),
        axios.get('https://barbearia-backend-dja2.onrender.com/api/services')
      ]);
      setAppointments(appRes.data);
      setBarbeiros(barbRes.data);
      setServicos(servRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      if (error.response?.status === 401) {
        // Se o Java disser que o token expirou ou é de um E-MAIL INVÁLIDO:
        handleLogout();      // 1. Chuta o usuário para a tela de login
        setAuthError(true);  // 2. Abre o pop-up bonitinho de "Acesso Negado"
      }
    }
  };

  useEffect(() => {
    if (autoConfirmModal.isOpen) return; 

    const pending = appointments.find(app => {
      if (app.status !== 'SCHEDULED') return false; 
      if (ignoredAutoConfirms.includes(app.id)) return false; 

      const appStart = new Date(app.appointmentTime);
      const duration = app.service?.durationMinutes || 30; 
      const appEnd = new Date(appStart.getTime() + duration * 60000); 

      return now >= appEnd; 
    });

    if (pending) {
      setAutoConfirmModal({ isOpen: true, appointment: pending });
    }
  }, [now, appointments, ignoredAutoConfirms, autoConfirmModal.isOpen]);

  const stats = useMemo(() => {
    const hojeStr = now.toDateString();
    const completados = appointments.filter(a => a.status === 'COMPLETED');

    const totalHoje = completados
      .filter(a => new Date(a.appointmentTime).toDateString() === hojeStr)
      .reduce((acc, a) => acc + (a.service?.price || 0), 0);

    const totalSemana = completados
      .filter(a => {
        const d = new Date(a.appointmentTime);
        const limite = new Date(now);
        limite.setDate(now.getDate() - 7);
        return d >= limite && d <= now;
      })
      .reduce((acc, a) => acc + (a.service?.price || 0), 0);

    const totalMes = completados
      .filter(a => new Date(a.appointmentTime).getMonth() === now.getMonth())
      .reduce((acc, a) => acc + (a.service?.price || 0), 0);

    return { totalHoje, totalSemana, totalMes };
  }, [appointments, now]);

  const chartData = useMemo(() => {
    const contagem = {};
    appointments.forEach(a => {
      const nomeServico = a.service?.name || 'Outros';
      contagem[nomeServico] = (contagem[nomeServico] || 0) + 1;
    });
    return Object.keys(contagem).map(key => ({ name: key, total: contagem[key] }));
  }, [appointments]);

  const agendaFiltrada = useMemo(() => {
    const hojeInicio = new Date(now);
    hojeInicio.setHours(0, 0, 0, 0);
    const hojeFim = new Date(now);
    hojeFim.setHours(23, 59, 59, 999);
    const limiteSemana = new Date(now);
    limiteSemana.setDate(now.getDate() + 7);
    const limiteMes = new Date(now);
    limiteMes.setDate(now.getDate() + 30);

    return appointments
      .filter(a => {
        if (a.status !== 'SCHEDULED') return false;
        
        const dataApp = new Date(a.appointmentTime);
        let passaTempo = true;
        if (filtroAgenda === 'hoje') passaTempo = dataApp >= hojeInicio && dataApp <= hojeFim;
        else if (filtroAgenda === 'semana') passaTempo = dataApp >= hojeInicio && dataApp <= limiteSemana;
        else if (filtroAgenda === 'mês') passaTempo = dataApp >= hojeInicio && dataApp <= limiteMes;

        let passaBarbeiro = true;
        if (filtroBarbeiro !== 'todos') {
          passaBarbeiro = String(a.barber?.id) === String(filtroBarbeiro);
        }

        return passaTempo && passaBarbeiro;
      })
      .sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));
  }, [appointments, filtroAgenda, filtroBarbeiro, now]);

  // AÇÕES
  const handleFinalizar = async (id) => {
    try {
      await axios.patch(`https://barbearia-backend-dja2.onrender.com/api/appointments/${id}/complete`);
      fetchData();
    } catch (e) { 
      console.error("Erro ao finalizar atendimento."); 
    }
  };

  const handleCancelAction = (app) => {
    setCancelModal({ isOpen: true, appointment: app });
  };

  const confirmCancel = async () => {
    const app = cancelModal.appointment;
    try {
      await axios.delete(`https://barbearia-backend-dja2.onrender.com/api/appointments/${app.id}`);
      setAppointments(prev => prev.filter(item => item.id !== app.id));
      setCancelModal({ isOpen: false, appointment: null });
    } catch (err) {
      console.error("Erro ao cancelar no banco:", err);
      alert("Ocorreu um erro ao tentar excluir o agendamento no servidor.");
    }
  };

  const openDeleteModal = (type, id) => setDeleteModal({ isOpen: true, type, id });
  const closeDeleteModal = () => setDeleteModal({ isOpen: false, type: '', id: null });

  const confirmDelete = async () => {
    const { type, id } = deleteModal;
    try {
      if (type === 'barbeiro') {
        await axios.delete(`https://barbearia-backend-dja2.onrender.com/api/barbers/${id}`);
        setBarbeiros(prev => prev.filter(b => b.id !== id));
      } else if (type === 'servico') {
        await axios.delete(`https://barbearia-backend-dja2.onrender.com/api/services/${id}`);
        setServicos(prev => prev.filter(s => s.id !== id));
      }
      closeDeleteModal(); 
    } catch (error) {
      console.error("Erro ao remover:", error);
      alert(`Erro no banco de dados. O Java recusou a exclusão.`);
      closeDeleteModal(); 
    }
  };

  const handleAttemptRemove = (type, itemId) => {
    let relatedApps = [];
    let item = null;

    if (type === 'barbeiro') {
      item = barbeiros.find(b => b.id === itemId);
      relatedApps = appointments.filter(app => app.barber?.id === itemId);
    } else if (type === 'servico') {
      item = servicos.find(s => s.id === itemId);
      relatedApps = appointments.filter(app => app.service?.id === itemId);
    }

    if (relatedApps.length > 0) {
      setBulkDeleteModal({ isOpen: true, type, item, relatedApps });
    } else {
      openDeleteModal(type, itemId);
    }
  };

  const confirmBulkDelete = async () => {
    const { type, item, relatedApps } = bulkDeleteModal;
    try {
      await Promise.all(relatedApps.map(app => axios.delete(`https://barbearia-backend-dja2.onrender.com/api/appointments/${app.id}`)));
      if (type === 'barbeiro') {
        await axios.delete(`https://barbearia-backend-dja2.onrender.com/api/barbers/${item.id}`);
      } else {
        await axios.delete(`https://barbearia-backend-dja2.onrender.com/api/services/${item.id}`);
      }
      const futuros = relatedApps.filter(app => app.status === 'SCHEDULED');
      setBulkDeleteModal({ isOpen: false, type: '', item: null, relatedApps: [] });
      setSummaryModal({ isOpen: true, type, cancelledApps: futuros });
      fetchData();
    } catch (error) {
      console.error("Erro na deleção em massa:", error);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setFormData({ name: '', price: '', duration: '' });
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (modalType === 'barbeiro') {
      try {
        await axios.post('https://barbearia-backend-dja2.onrender.com/api/barbers', { 
          name: formData.name, 
          photoUrl: '/barbeiros/bonec.jpg',
          tenant: { id: tenantId }, 
          isActive: true 
        });
        fetchData();
        closeModal();
      } catch (error) {
        console.error("Erro ao adicionar barbeiro.");
      }
    } else if (modalType === 'servico') {
      const preco = parseFloat(formData.price.replace(',', '.'));
      const duracao = parseInt(formData.duration);
      if (isNaN(preco) || isNaN(duracao)) return alert("Preço ou duração inválidos!");
      try {
        await axios.post('https://barbearia-backend-dja2.onrender.com/api/services', {
          name: formData.name, price: preco, durationMinutes: duracao,
          tenant: { id: tenantId }, isActive: true
        });
        fetchData();
        closeModal();
      } catch (error) {
        console.error("Erro ao salvar serviço.");
      }
    }
  };

  const handleLoginSuccess = (credentialResponse) => {
    // Esconde qualquer erro anterior ao tentar logar de novo
    setAuthError(false);
    const jwt = credentialResponse.credential;
    localStorage.setItem('adminToken', jwt);
    setToken(jwt);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  const bgGlobal = isDarkMode ? 'bg-[#09090b]' : 'bg-[#f4f4f6]';
  const textGlobal = isDarkMode ? 'text-zinc-100' : 'text-slate-800';
  const cardBg = isDarkMode ? 'bg-white/[0.03] backdrop-blur-xl' : 'bg-white/90 backdrop-blur-xl';
  const cardBorder = isDarkMode ? 'border-white/10' : 'border-slate-200/80';

  const fadeVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 }
  };

  // === TELA DE LOGIN ===
  if (!token) {
    return (
      <div style={themeVars} className={`min-h-screen ${bgGlobal} ${textGlobal} flex items-center justify-center p-4 transition-colors duration-500 relative overflow-hidden`}>
        <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[var(--theme-10)] to-transparent pointer-events-none z-0"></div>
        <div className={`relative z-10 p-8 sm:p-10 rounded-[32px] border ${cardBg} ${cardBorder} shadow-2xl max-w-md w-full flex flex-col items-center text-center`}>
          <div className="w-20 h-20 bg-[var(--theme-main)] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(72,192,208,0.3)]">
            <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">Acesso Restrito</h1>
          <p className={`text-sm mb-10 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Faça login com sua conta do Google autorizada para acessar e gerenciar o painel da barbearia.</p>
          <GoogleLogin onSuccess={handleLoginSuccess} onError={() => alert("Erro ao fazer login com o Google")} theme={isDarkMode ? "filled_black" : "outline"} size="large" shape="pill" width="100%" />
        </div>

        {/* --- POP-UP DE ACESSO NEGADO (E-MAIL INVÁLIDO) --- */}
        <AnimatePresence>
          {authError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-sm shadow-2xl text-center border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black uppercase text-red-500 mb-2">Acesso Negado</h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                  O e-mail utilizado <strong>não possui permissão</strong> para acessar o painel administrativo.
                </p>
                <button onClick={() => setAuthError(false)} className="w-full bg-[var(--theme-main)] text-[#09090b] px-4 py-3 rounded-xl font-black text-xs uppercase hover:scale-105 transition-transform cursor-pointer">
                  Tentar Novamente
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // === PAINEL ADMIN ===
  return (
    <div style={themeVars} className={`min-h-screen ${bgGlobal} ${textGlobal} p-4 md:p-8 font-sans relative overflow-x-hidden transition-colors duration-500`}>
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[var(--theme-10)] to-transparent pointer-events-none z-0"></div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--theme-20); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--theme-40); }
      `}</style>

      <header className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-10 w-full relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[var(--theme-main)] to-[#83d9e4]">Club do Rafa</h1>
        </div>
        
        <div className={`flex flex-col sm:flex-row items-center w-full lg:w-auto gap-4 p-2 rounded-2xl sm:rounded-full border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200/80 shadow-sm'}`}>
          <nav className="flex w-full sm:w-auto justify-between gap-1 sm:gap-2">
            {['dashboard', 'barbeiros', 'serviços'].map(tab => (
              <button key={tab} onClick={() => setView(tab)} className={`flex-1 sm:flex-none px-2 sm:px-6 py-3 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap cursor-pointer ${view === tab ? 'bg-[var(--theme-main)] text-[#09090b] shadow-lg shadow-[var(--theme-main)]/20' : `hover:bg-[var(--theme-10)] ${isDarkMode ? 'text-zinc-400 hover:text-zinc-100' : 'text-slate-500 hover:text-slate-900'}`}`}>
                {tab}
              </button>
            ))}
          </nav>
          <div className={`hidden sm:block w-px h-8 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}></div>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`cursor-pointer flex items-center justify-center w-10 h-10 shrink-0 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 hover:shadow-lg hover:shadow-yellow-400/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-md'}`}>
              {isDarkMode ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="3.5" opacity="0.5" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            <button onClick={handleLogout} className={`cursor-pointer flex items-center justify-center w-10 h-10 shrink-0 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`} title="Sair do Painel">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          
          {/* Aba DASHBOARD */}
          {view === 'dashboard' && (
            <motion.div key="dashboard" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
              
              <div className="xl:col-span-1 flex flex-col gap-6">
                <div className={`p-8 rounded-[32px] border ${cardBg} ${cardBorder} shadow-2xl relative overflow-hidden`}>
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-[var(--theme-main)] blur-[80px] opacity-20 rounded-full"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-70">Resumo Financeiro</h2>
                  <div className="space-y-6">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Hoje</p>
                      <p className="text-4xl md:text-5xl font-black tracking-tighter">R$ {stats.totalHoje.toFixed(2)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Semana</p>
                        <p className="text-xl font-black">R$ {stats.totalSemana.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Mês</p>
                        <p className="text-xl font-black text-[var(--theme-main)]">R$ {stats.totalMes.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-[32px] border ${cardBg} ${cardBorder} flex flex-col items-center justify-center flex-1 min-h-[300px]`}>
                  <h2 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-70 self-start">Serviços Populares</h2>
                  <div className="w-full h-full flex items-center justify-center">
                    {chartData.length === 0 ? (
                       <div className={`flex flex-col items-center justify-center opacity-50 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                         <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <p className="text-xs font-bold uppercase tracking-wider">Nenhum agendamento no momento</p>
                       </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="total" nameKey="name">
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#18181b' : '#ffffff', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', borderRadius: '16px'}} itemStyle={{color: isDarkMode ? '#f4f4f5' : '#1e293b', fontSize: '13px', fontWeight: 'bold'}} />
                          <Legend iconType="circle" wrapperStyle={{fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: isDarkMode ? '#a1a1aa' : '#64748b', paddingTop: '10px'}} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <div className={`xl:col-span-2 flex flex-col p-5 sm:p-8 rounded-3xl border ${cardBg} ${cardBorder} shadow-xl`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 border-b pb-6 border-white/5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-1">Próximos Clientes</h2>
                    <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Acompanhe a agenda em tempo real</p>
                  </div>
                  
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto z-40 relative">
                    <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDarkMode ? 'bg-black/50 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                      {['hoje', 'semana', 'mês'].map(f => (
                        <button key={f} onClick={() => setFiltroAgenda(f)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${filtroAgenda === f ? 'bg-[var(--theme-main)] text-[#09090b]' : isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>{f}</button>
                      ))}
                    </div>

                    <div className="relative">
                      <button onClick={() => setIsBarberDropdownOpen(!isBarberDropdownOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${isBarberDropdownOpen ? 'bg-[var(--theme-10)] text-[var(--theme-main)] border-[var(--theme-main)]' : (isDarkMode ? 'bg-black/50 border-white/10 text-zinc-300 hover:border-white/20' : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300')}`}>
                         {filtroBarbeiro === 'todos' ? 'Todos os Barbeiros' : barbeiros.find(b => b.id === filtroBarbeiro)?.name || 'Todos os Barbeiros'}
                         <svg className={`w-3 h-3 transition-transform ${isBarberDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                      
                      <AnimatePresence>
                        {isBarberDropdownOpen && (
                          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className={`absolute top-full mt-2 w-full left-0 border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 origin-top backdrop-blur-xl ${isDarkMode ? 'bg-[#18181b]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                            <button onClick={() => { setFiltroBarbeiro('todos'); setIsBarberDropdownOpen(false); }} className={`flex items-center gap-3 w-full text-left px-4 py-3 text-xs font-bold uppercase transition-colors cursor-pointer ${filtroBarbeiro === 'todos' ? 'bg-[var(--theme-10)] text-[var(--theme-main)]' : (isDarkMode ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}`}>
                               <svg className="w-4 h-4 text-white mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                               Todos
                            </button>
                            {barbeiros.map(b => (
                               <button key={b.id} onClick={() => { setFiltroBarbeiro(b.id); setIsBarberDropdownOpen(false); }} className={`flex items-center gap-3 w-full text-left px-4 py-3 text-xs font-bold uppercase transition-colors cursor-pointer border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'} ${filtroBarbeiro === b.id ? 'bg-[var(--theme-10)] text-[var(--theme-main)]' : (isDarkMode ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}`}>
                                 <img src={getBarberPhoto(b.name)} alt={b.name} className={`w-6 h-6 rounded-full object-cover border ${isDarkMode ? 'border-white/20' : 'border-slate-200'}`} />
                                 {b.name}
                               </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 relative z-10">
                  {agendaFiltrada.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 opacity-50">
                      <svg className="w-16 h-16 mb-4 text-[var(--theme-main)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <p className="text-sm font-black uppercase tracking-widest text-center">Nenhum cliente agendado</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-center">Para o período/barbeiro selecionado</p>
                    </div>
                  ) : (
                    agendaFiltrada.map(app => {
                      const appDate = new Date(app.appointmentTime);
                      return (
                        <motion.div key={app.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }} className={`group p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300 hover:shadow-lg ${isDarkMode ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 hover:border-white/10' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-[var(--theme-main)]'}`}>
                          <div className="w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
                              <span className="text-base sm:text-lg font-black uppercase tracking-tight">{app.customerName}</span>
                              <span className="text-[10px] bg-[var(--theme-10)] text-[var(--theme-main)] px-2 py-1 rounded-md font-bold self-start sm:self-auto uppercase tracking-widest">
                                {appDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} - {appDate.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 font-bold uppercase tracking-wide flex items-center gap-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                              {app.service?.name} 
                              <span className="w-1 h-1 rounded-full bg-[var(--theme-main)]"></span> 
                              <span className={isDarkMode ? 'text-zinc-300' : 'text-slate-700'}>{app.barber?.name}</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                            <button onClick={() => handleCancelAction(app)} className={`px-4 py-3 sm:py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border cursor-pointer w-full sm:w-auto ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-500 hover:text-white'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                              Excluir
                            </button>
                            <button onClick={() => handleFinalizar(app.id)} className="w-full sm:w-auto bg-[var(--theme-main)] text-[#09090b] px-5 py-3 sm:py-2.5 rounded-xl font-black text-[10px] uppercase hover:scale-105 transition-transform flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[var(--theme-main)]/20">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                              Finalizar
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Aba BARBEIROS */}
          {view === 'barbeiros' && (
            <motion.div key="barbeiros" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              
              {/* Botão Novo Barbeiro */}
              <button onClick={() => openModal('barbeiro')} className={`group min-h-[280px] border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${isDarkMode ? 'border-white/10 hover:border-[var(--theme-main)] hover:bg-white/5' : 'border-slate-200 hover:border-[var(--theme-main)] hover:bg-slate-50'}`}>
                <div className="w-16 h-16 rounded-full bg-[var(--theme-main)] flex items-center justify-center text-[#09090b] group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-sm font-black uppercase tracking-widest">Novo Barbeiro</span>
              </button>

              {barbeiros.map(item => (
                <div key={item.id} className={`group relative p-8 rounded-[32px] border flex flex-col items-center text-center transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${cardBg} ${isDarkMode ? 'border-white/10 hover:border-[var(--theme-main)]' : 'border-slate-200 shadow-sm hover:border-[var(--theme-main)]'}`}>
                  
                  <div className={`w-32 h-32 mb-6 rounded-full overflow-hidden border-4 transition-transform duration-300 group-hover:scale-105 ${isDarkMode ? 'border-white/10 bg-white/5 group-hover:border-[var(--theme-main)]' : 'border-slate-100 bg-slate-50 group-hover:border-[var(--theme-main)]'}`}>
                    <img src={getBarberPhoto(item.name)} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  
                  <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-zinc-100' : 'text-slate-800'}`}>{item.name}</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-6 px-3 py-1 rounded-md ${isDarkMode ? 'bg-white/5 text-zinc-400' : 'bg-slate-100 text-slate-500'}`}>Profissional</p>
                  
                  <div className={`mt-auto pt-5 border-t w-full flex justify-center transition-colors duration-300 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <button onClick={() => handleAttemptRemove('barbeiro', item.id)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border cursor-pointer hover:scale-105 ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-500 hover:text-white'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Aba SERVIÇOS */}
          {view === 'serviços' && (
            <motion.div key="serviços" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              
              {/* Botão Novo Serviço */}
              <button onClick={() => openModal('servico')} className={`group min-h-[280px] border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${isDarkMode ? 'border-white/10 hover:border-[var(--theme-main)] hover:bg-white/5' : 'border-slate-200 hover:border-[var(--theme-main)] hover:bg-slate-50'}`}>
                <div className="w-16 h-16 rounded-full bg-[var(--theme-main)] flex items-center justify-center text-[#09090b] group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-sm font-black uppercase tracking-widest">Novo Serviço</span>
              </button>

              {servicos.map(item => (
                <div key={item.id} className={`group relative p-8 rounded-[32px] border flex flex-col items-center text-center transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${cardBg} ${isDarkMode ? 'border-white/10 hover:border-[var(--theme-main)]' : 'border-slate-200 shadow-sm hover:border-[var(--theme-main)]'}`}>
                  
                  <div className={`w-20 h-20 mb-6 rounded-2xl flex items-center justify-center rotate-3 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110 ${isDarkMode ? 'bg-[var(--theme-10)] text-[var(--theme-main)]' : 'bg-slate-100 text-[var(--theme-main)]'}`}>
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <circle cx="6" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                      <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                      <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                    </svg>
                  </div>
                  
                  <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-zinc-100' : 'text-slate-800'}`}>{item.name}</h3>
                  <div className="flex flex-col items-center gap-1 mb-6">
                    <span className="text-2xl font-black text-[var(--theme-main)]">R$ {item.price.toFixed(2)}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{item.durationMinutes} Minutos</span>
                  </div>
                  
                  <div className={`mt-auto pt-5 border-t w-full flex justify-center transition-colors duration-300 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                    <button onClick={() => handleAttemptRemove('servico', item.id)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border cursor-pointer hover:scale-105 ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-500 hover:text-white'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* --- MODAIS DE CADASTRO --- */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-md shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
              <h3 className="text-xl font-black uppercase text-[var(--theme-main)] mb-6">Adicionar {modalType === 'servico' ? 'Serviço' : 'Barbeiro'}</h3>
              
              <form onSubmit={handleModalSubmit} className="space-y-4">
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Nome</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full rounded-xl p-3 text-sm outline-none border focus:border-[var(--theme-main)] ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
                
                {modalType === 'servico' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Preço (R$)</label>
                      <input type="text" required placeholder="Ex: 45.00" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className={`w-full rounded-xl p-3 text-sm outline-none border focus:border-[var(--theme-main)] ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                    </div>
                    <div>
                      <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Duração (Min)</label>
                      <input type="number" required placeholder="Ex: 30" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} className={`w-full rounded-xl p-3 text-sm outline-none border focus:border-[var(--theme-main)] ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={closeModal} className={`w-full flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancelar</button>
                  <button type="submit" className="w-full flex-1 bg-[var(--theme-main)] text-[#09090b] px-4 py-3 rounded-xl font-black text-xs uppercase hover:scale-105 transition-transform cursor-pointer">Salvar</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Exclusão Simples */}
        {deleteModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-xs text-center shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-xl font-black uppercase text-red-500 mb-2">Remover Item</h3>
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Tem certeza? Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={closeDeleteModal} className={`w-full flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Voltar</button>
                <button onClick={confirmDelete} className="w-full flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-black text-xs uppercase hover:bg-red-600 cursor-pointer">Sim, Remover</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Exclusão em Massa (Aviso de conflito na agenda) */}
        {bulkDeleteModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-md shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                   <h3 className="text-lg font-black uppercase leading-tight text-orange-500">Atenção!</h3>
                   <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Conflito na Agenda</p>
                </div>
              </div>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-zinc-300' : 'text-slate-600'}`}>
                Você está tentando excluir <strong>{bulkDeleteModal.item?.name}</strong>, mas existem <strong className="text-red-500">{bulkDeleteModal.relatedApps.length} agendamentos</strong> vinculados a isso no sistema.
              </p>
              <div className={`p-4 rounded-xl border mb-6 ${isDarkMode ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-xs font-bold uppercase ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  Se você continuar, todos esses agendamentos serão <span className="underline">cancelados permanentemente</span>.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setBulkDeleteModal({ isOpen: false, type: '', item: null, relatedApps: [] })} className={`w-full flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancelar</button>
                <button onClick={confirmBulkDelete} className="w-full flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-600 cursor-pointer text-center leading-tight">
                  Sim, Excluir<br/>Tudo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Resumo após Exclusão em Massa */}
        {summaryModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-sm text-center shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase text-green-500 mb-2">Sucesso!</h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                   O {summaryModal.type} foi removido com sucesso. 
                   {summaryModal.cancelledApps.length > 0 && (
                     <span className="block mt-2 font-bold text-red-500">
                       Atenção: {summaryModal.cancelledApps.length} clientes tiveram seus agendamentos futuros cancelados por causa disso.
                     </span>
                   )}
                </p>
                <button onClick={() => setSummaryModal({ isOpen: false, type: '', cancelledApps: [] })} className="w-full bg-[var(--theme-main)] text-[#09090b] px-4 py-3 rounded-xl font-black text-xs uppercase hover:scale-105 transition-transform cursor-pointer">
                  Entendi
                </button>
             </motion.div>
          </motion.div>
        )}

        {/* Modal de Confirmação de Cancelamento Individual */}
        {cancelModal.isOpen && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-xs text-center shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                 <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </div>
                 <h3 className="text-xl font-black uppercase text-red-500 mb-2">Excluir Agendamento</h3>
                 <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Tem certeza que deseja cancelar o agendamento de <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{cancelModal.appointment?.customerName}</strong>?</p>
                 <div className="flex gap-3">
                    <button onClick={() => setCancelModal({ isOpen: false, appointment: null })} className={`w-full flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Voltar</button>
                    <button onClick={confirmCancel} className="w-full flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-black text-xs uppercase hover:bg-red-600 cursor-pointer">Sim, Excluir</button>
                 </div>
              </motion.div>
           </motion.div>
        )}

        {/* Modal de Finalização Automática */}
        {autoConfirmModal.isOpen && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-sm shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 bg-[var(--theme-10)] text-[var(--theme-main)] rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <div>
                      <h3 className="text-lg font-black uppercase leading-tight">Tempo Esgotado</h3>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Atendimento de {autoConfirmModal.appointment?.customerName}</p>
                   </div>
                </div>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-300' : 'text-slate-600'}`}>O tempo estimado para este serviço acabou. Deseja finalizar este agendamento agora?</p>
                <div className="flex gap-2">
                   <button onClick={() => { setIgnoredAutoConfirms(prev => [...prev, autoConfirmModal.appointment.id]); setAutoConfirmModal({ isOpen: false, appointment: null }); }} className={`flex-1 px-3 py-3 rounded-xl font-black text-[10px] uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Ainda Não</button>
                   <button onClick={() => { handleFinalizar(autoConfirmModal.appointment.id); setAutoConfirmModal({ isOpen: false, appointment: null }); }} className="flex-1 bg-[var(--theme-main)] text-[#09090b] px-3 py-3 rounded-xl font-black text-[10px] uppercase hover:scale-105 transition-transform cursor-pointer shadow-lg shadow-[var(--theme-main)]/20">Sim, Finalizar</button>
                </div>
              </motion.div>
           </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}