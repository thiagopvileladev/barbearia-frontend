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
  const [authError, setAuthError] = useState(false);

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
        handleLogout();
        setAuthError(true);
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
            <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2" /></svg>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Painel de <span className="text-[var(--theme-main)]">Acesso</span></h2>
          <p className={`text-sm mb-8 font-medium ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Faça login com sua conta administrativa</p>
          
          <div className="w-full relative bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200">
            <div className="flex items-center justify-center p-1">
               <GoogleLogin
                 onSuccess={handleLoginSuccess}
                 onError={() => { console.log('Login Failed'); }}
                 useOneTap
                 theme="filled_blue"
                 shape="pill"
                 size="large"
                 text="signin_with"
                 locale="pt-BR"
               />
            </div>
          </div>
          
          {authError && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-2 w-full">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <p className="text-red-500 text-xs font-bold uppercase text-center">Acesso Negado<br/><span className="font-medium text-[10px] text-red-400">E-mail não autorizado. Tente com outra conta.</span></p>
             </motion.div>
          )}
        </div>
      </div>
    );
  }

  // === TELA PRINCIPAL (DASHBOARD LOGADO) ===
  return (
    <div style={themeVars} className={`min-h-screen ${bgGlobal} ${textGlobal} font-sans selection:bg-[var(--theme-main)] selection:text-black transition-colors duration-500`}>
      {/* HEADER */}
      <header className={`sticky top-0 z-40 backdrop-blur-2xl border-b ${cardBorder} ${isDarkMode ? 'bg-[#09090b]/80' : 'bg-white/80'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[var(--theme-main)] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(72,192,208,0.4)]">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-none">Painel <span className="text-[var(--theme-main)]">Admin</span></h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Gestão Inteligente</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2.5 rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}>
                {isDarkMode ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
             </button>
             <button onClick={handleLogout} className={`p-2.5 rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-red-400 hover:bg-red-500/20' : 'bg-slate-100 border-slate-200 text-red-500 hover:bg-red-50'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row gap-8">
        
        {/* SIDEBAR NAVEGAÇÃO */}
        <nav className="md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 scrollbar-hide">
          {[ 
            { id: 'dashboard', label: 'Dashboard', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z' },
            { id: 'agenda', label: 'Agenda', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'barbeiros', label: 'Barbeiros', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
            { id: 'servicos', label: 'Serviços', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex-shrink-0 flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                view === item.id
                  ? 'bg-[var(--theme-main)] text-[#09090b] shadow-[0_0_20px_var(--theme-20)]'
                  : `${isDarkMode ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            
            {/* Aba DASHBOARD */}
            {view === 'dashboard' && (
              <motion.div key="dashboard" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[ 
                    { label: 'Hoje', value: stats.totalHoje, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { label: '7 Dias', value: stats.totalSemana, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                    { label: 'Mês', value: stats.totalMes, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
                  ].map((stat, i) => (
                    <div key={i} className={`p-6 rounded-[32px] border ${cardBg} ${cardBorder} flex items-center gap-5 hover:scale-[1.02] transition-transform`}>
                      <div className="w-14 h-14 rounded-2xl bg-[var(--theme-10)] flex items-center justify-center text-[var(--theme-main)]">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Faturamento {stat.label}</p>
                        <p className="text-2xl font-black">R$ {stat.value.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-6 sm:p-8 rounded-[32px] border ${cardBg} ${cardBorder}`}>
                  <h2 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--theme-main)]"></span> Distribuição de Serviços
                  </h2>
                  <div className="h-[300px] w-full relative">
                    {chartData.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                        <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs font-bold uppercase tracking-wider">Nenhum dado disponível</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="total" nameKey="name">
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#09090b' : '#fff', borderColor: isDarkMode ? '#27272a' : '#e2e8f0', borderRadius: '16px', fontWeight: 'bold'}} itemStyle={{color: isDarkMode ? '#fff' : '#000'}} />
                          <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold', paddingTop: '20px'}} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Aba AGENDA */}
            {view === 'agenda' && (
              <motion.div key="agenda" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                   <div className={`flex p-1 rounded-xl border ${cardBg} ${cardBorder} w-full sm:w-auto`}>
                     {['hoje', 'semana', 'mês'].map(f => (
                       <button key={f} onClick={() => setFiltroAgenda(f)} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filtroAgenda === f ? 'bg-[var(--theme-main)] text-black shadow-md' : `text-zinc-500 hover:text-zinc-300`}`}>
                         {f}
                       </button>
                     ))}
                   </div>
                   
                   <div className="relative w-full sm:w-64">
                     <button onClick={() => setIsBarberDropdownOpen(!isBarberDropdownOpen)} className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border ${cardBg} ${cardBorder} font-bold text-xs uppercase tracking-wider`}>
                       <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-[var(--theme-main)]"></span>
                         {filtroBarbeiro === 'todos' ? 'Todos os Barbeiros' : barbeiros.find(b => String(b.id) === String(filtroBarbeiro))?.name || 'Selecione'}
                       </div>
                       <svg className={`w-4 h-4 transition-transform ${isBarberDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                     </button>
                     <AnimatePresence>
                       {isBarberDropdownOpen && (
                         <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`absolute top-full mt-2 w-full rounded-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'} shadow-xl overflow-hidden z-50`}>
                            <button onClick={() => { setFiltroBarbeiro('todos'); setIsBarberDropdownOpen(false); }} className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[var(--theme-5)] ${filtroBarbeiro === 'todos' ? 'text-[var(--theme-main)]' : ''}`}>Todos</button>
                            {barbeiros.map(b => (
                               <button key={b.id} onClick={() => { setFiltroBarbeiro(String(b.id)); setIsBarberDropdownOpen(false); }} className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[var(--theme-5)] ${filtroBarbeiro === String(b.id) ? 'text-[var(--theme-main)]' : ''}`}>{b.name}</button>
                            ))}
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                </div>

                <div className="space-y-4">
                  {agendaFiltrada.length === 0 ? (
                    <div className={`p-12 rounded-[32px] border ${cardBg} ${cardBorder} text-center`}>
                      <p className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Nenhum agendamento encontrado.</p>
                    </div>
                  ) : (
                    agendaFiltrada.map(app => {
                      const appTime = new Date(app.appointmentTime);
                      const isLate = now > new Date(appTime.getTime() + (app.service?.durationMinutes || 30) * 60000);
                      const isNow = now >= appTime && now <= new Date(appTime.getTime() + (app.service?.durationMinutes || 30) * 60000);
                      
                      return (
                        <div key={app.id} className={`p-5 sm:p-6 rounded-[24px] border ${cardBg} ${cardBorder} flex flex-col md:flex-row items-center gap-6 hover:border-[var(--theme-main)] transition-colors relative overflow-hidden group`}>
                          {isNow && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--theme-main)] animate-pulse"></div>}
                          {isLate && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}
                          
                          <div className="flex-shrink-0 text-center w-full md:w-auto">
                            <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'} mb-1`}>{appTime.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</p>
                            <p className={`text-2xl sm:text-3xl font-black ${isLate ? 'text-red-500' : isNow ? 'text-[var(--theme-main)]' : ''}`}>{appTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                          
                          <div className="flex-1 text-center md:text-left">
                            <h3 className="text-lg font-black uppercase leading-tight">{app.customerName}</h3>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center justify-center md:justify-start gap-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                              {app.service?.name} 
                              <span className="w-1 h-1 rounded-full bg-[var(--theme-main)]"></span> 
                              <span className={isDarkMode ? 'text-zinc-300' : 'text-slate-700'}>{app.barber?.name}</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                            <button onClick={() => handleCancelAction(app)} className={`px-4 py-3 sm:py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border cursor-pointer w-full sm:w-auto ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-500 hover:text-white'}`}>
                              Cancelar
                            </button>
                            <button onClick={() => handleFinalizar(app.id)} className="flex-1 md:flex-none px-6 py-3 sm:py-2.5 rounded-xl bg-[var(--theme-main)] text-[#09090b] text-[10px] font-black uppercase hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg cursor-pointer w-full sm:w-auto">
                              Concluir
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* Aba BARBEIROS */}
            {view === 'barbeiros' && (
              <motion.div key="barbeiros" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <button onClick={() => openModal('barbeiro')} className={`group min-h-[280px] border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${isDarkMode ? 'border-white/10 hover:border-[var(--theme-main)] hover:bg-white/5' : 'border-slate-200 hover:border-[var(--theme-main)] hover:bg-slate-50'}`}>
                  <div className="w-16 h-16 rounded-full bg-[var(--theme-main)] flex items-center justify-center shadow-[0_0_20px_var(--theme-20)] group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-[#09090b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <p className="font-black text-xs uppercase tracking-widest text-[var(--theme-main)]">Novo Barbeiro</p>
                </button>
                {barbeiros.map(barbeiro => (
                  <div key={barbeiro.id} className={`relative p-6 rounded-[32px] border ${cardBg} ${cardBorder} flex flex-col items-center text-center group hover:border-[var(--theme-main)] transition-colors overflow-hidden`}>
                    <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-[var(--theme-10)] to-transparent"></div>
                    <img src={getBarberPhoto(barbeiro.name)} alt={barbeiro.name} className="w-24 h-24 rounded-full object-cover mb-4 z-10 border-4 border-[var(--theme-main)] shadow-xl" />
                    <h3 className="text-lg font-black uppercase mb-1 z-10">{barbeiro.name}</h3>
                    <div className="mt-auto pt-6 w-full z-10">
                      <button onClick={() => handleAttemptRemove('barbeiro', barbeiro.id)} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase border transition-colors flex items-center justify-center gap-2 cursor-pointer ${isDarkMode ? 'border-red-500/20 text-red-400 hover:bg-red-500/20' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Aba SERVIÇOS (Corrigida!) */}
            {view === 'servicos' && (
              <motion.div key="servicos" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <button onClick={() => openModal('servico')} className={`group min-h-[280px] border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${isDarkMode ? 'border-white/10 hover:border-[var(--theme-main)] hover:bg-white/5' : 'border-slate-200 hover:border-[var(--theme-main)] hover:bg-slate-50'}`}>
                  <div className="w-16 h-16 rounded-full bg-[var(--theme-main)] flex items-center justify-center shadow-[0_0_20px_var(--theme-20)] group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-[#09090b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <p className="font-black text-xs uppercase tracking-widest text-[var(--theme-main)]">Novo Serviço</p>
                </button>
                
                {servicos.map((servico) => (
                  <div key={servico.id} className={`relative p-6 rounded-[32px] border ${cardBg} ${cardBorder} flex flex-col group hover:border-[var(--theme-main)] transition-colors`}>
                    <div className="flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--theme-10)] flex items-center justify-center mb-4 text-[var(--theme-main)]">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
                      </div>
                      <h3 className="text-lg font-black uppercase leading-tight mb-2">{servico.name}</h3>
                      <p className={`text-2xl font-black text-[var(--theme-main)] mb-1`}>R$ {servico.price.toFixed(2)}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}><span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-600 mr-2"></span>{servico.durationMinutes} minutos</p>
                    </div>
                    <div className="mt-6">
                      <button onClick={() => handleAttemptRemove('servico', servico.id)} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase border transition-colors flex items-center justify-center gap-2 cursor-pointer ${isDarkMode ? 'border-red-500/20 text-red-400 hover:bg-red-500/20' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* --- MODAIS --- */}
      <AnimatePresence>
        {/* Modal Adicionar */}
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-md shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
              <h3 className="text-xl font-black uppercase text-[var(--theme-main)] mb-6">Adicionar {modalType === 'servico' ? 'Serviço' : 'Barbeiro'}</h3>
              <form onSubmit={handleModalSubmit} className="space-y-4">
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Nome</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-[var(--theme-main)] focus:outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder-zinc-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} placeholder="Ex: Corte Degradê" />
                </div>
                {modalType === 'servico' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Preço (R$)</label>
                      <input type="text" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-[var(--theme-main)] focus:outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder-zinc-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} placeholder="45,00" />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Duração (min)</label>
                      <input type="number" required value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-[var(--theme-main)] focus:outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder-zinc-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} placeholder="30" />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={closeModal} className={`flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancelar</button>
                  <button type="submit" className="flex-1 bg-[var(--theme-main)] text-[#09090b] px-4 py-3 rounded-xl font-black text-xs uppercase hover:scale-105 transition-transform cursor-pointer shadow-lg shadow-[var(--theme-20)]">Salvar</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Confirmação Deleção */}
        {deleteModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`p-8 rounded-[32px] w-full max-w-sm shadow-2xl border text-center ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase mb-2">Confirmar Exclusão</h3>
                <p className={`text-sm mb-8 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Tem certeza que deseja excluir este {deleteModal.type}? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3">
                   <button onClick={closeDeleteModal} className={`w-full flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Voltar</button>
                   <button onClick={confirmDelete} className="w-full flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-colors cursor-pointer">Excluir</button>
                </div>
             </motion.div>
          </motion.div>
        )}

        {/* Outros Modais (AutoConfirmar, Deleção em Massa, Resumo, Cancelar) */}
        {/* Bulk Delete Modal */}
        {bulkDeleteModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className={`p-8 rounded-[32px] w-full max-w-md shadow-2xl border text-center ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase mb-2 text-red-500">Atenção!</h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Existem <strong>{bulkDeleteModal.relatedApps.length} agendamentos</strong> vinculados a este {bulkDeleteModal.type} ({bulkDeleteModal.item?.name}).
                </p>
                <p className={`text-xs mb-8 ${isDarkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Para excluir o {bulkDeleteModal.type}, o sistema precisará cancelar todos esses agendamentos primeiro. Deseja prosseguir?</p>
                <div className="flex gap-2">
                   <button onClick={() => setBulkDeleteModal({isOpen:false, type:'', item:null, relatedApps:[]})} className={`flex-1 px-3 py-3 rounded-xl font-black text-[10px] uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancelar</button>
                   <button onClick={confirmBulkDelete} className="flex-1 bg-red-500 text-white px-3 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-600 transition-colors cursor-pointer">Apagar Tudo</button>
                </div>
             </motion.div>
          </motion.div>
        )}

        {/* Resumo Modal */}
        {summaryModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className={`p-8 rounded-[32px] w-full max-w-md shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-col items-center text-center mb-6">
                   <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                   </div>
                   <h3 className="text-xl font-black uppercase">{summaryModal.type} removido!</h3>
                   <p className={`text-xs mt-2 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Os seguintes agendamentos futuros foram cancelados e precisam ser remarcados:</p>
                </div>
                <div className={`max-h-40 overflow-y-auto mb-6 p-4 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                   {summaryModal.cancelledApps.length === 0 ? (
                      <p className="text-xs text-center font-bold text-zinc-500">Nenhum agendamento futuro afetado.</p>
                   ) : (
                      <ul className="space-y-3">
                         {summaryModal.cancelledApps.map(app => (
                            <li key={app.id} className="flex justify-between items-center text-xs">
                               <span className="font-bold">{app.customerName}</span>
                               <span className={isDarkMode ? 'text-zinc-400' : 'text-slate-500'}>{new Date(app.appointmentTime).toLocaleDateString('pt-BR')} às {new Date(app.appointmentTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </li>
                         ))}
                      </ul>
                   )}
                </div>
                <button onClick={() => setSummaryModal({isOpen:false, type:'', cancelledApps:[]})} className="w-full bg-[var(--theme-main)] text-[#09090b] px-4 py-3 rounded-xl font-black text-xs uppercase hover:scale-105 transition-transform cursor-pointer">Ciente</button>
             </motion.div>
          </motion.div>
        )}

        {/* Cancel Modal */}
        {cancelModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className={`p-8 rounded-[32px] w-full max-w-sm shadow-2xl border text-center ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase mb-2">Cancelar Agendamento</h3>
                <p className={`text-sm mb-8 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Tem certeza que deseja cancelar o agendamento de <span className="font-bold">{cancelModal.appointment?.customerName}</span>?</p>
                <div className="flex gap-3">
                   <button onClick={() => setCancelModal({isOpen:false, appointment:null})} className={`w-full flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Voltar</button>
                   <button onClick={confirmCancel} className="w-full flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-colors cursor-pointer">Cancelar</button>
                </div>
             </motion.div>
          </motion.div>
        )}

        {/* Auto Confirm Modal */}
        {autoConfirmModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-6 right-6 z-50">
             <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`p-6 rounded-3xl w-80 shadow-2xl border ${isDarkMode ? 'bg-[#09090b] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start gap-4 mb-4">
                   <div className="w-12 h-12 rounded-full bg-[var(--theme-10)] flex items-center justify-center text-[var(--theme-main)] flex-shrink-0">
                      <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <div>
                      <h3 className="text-lg font-black uppercase leading-tight">Tempo Esgotado</h3>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Atendimento de {autoConfirmModal.appointment?.customerName}</p>
                   </div>
                </div>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-zinc-300' : 'text-slate-600'}`}>O tempo estimado para este serviço acabou. Deseja finalizar este agendamento agora?</p>
                <div className="flex gap-2">
                   <button onClick={() => { setIgnoredAutoConfirms(prev => [...prev, autoConfirmModal.appointment.id]); setAutoConfirmModal({ isOpen: false, appointment: null }); }} className={`flex-1 px-3 py-3 rounded-xl font-black text-[10px] uppercase cursor-pointer ${isDarkMode ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Ainda Não</button>
                   <button onClick={() => { handleFinalizar(autoConfirmModal.appointment.id); setAutoConfirmModal({ isOpen: false, appointment: null }); }} className="flex-1 bg-[var(--theme-main)] text-[#09090b] px-3 py-3 rounded-xl font-black text-[10px] uppercase hover:scale-105 transition-transform cursor-pointer shadow-lg shadow-[var(--theme-20)]">Finalizar</button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}