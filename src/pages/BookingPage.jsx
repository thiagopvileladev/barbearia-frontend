import { useEffect, useState } from 'react';
import axios from 'axios';

// --- COPIAR DAQUI ---
const GALLERY_IMAGES = [
  "/cortes/ney.jpg",
  "/cortes/ney2.jpg",
  "/cortes/ney3.jpg",
  "/cortes/ney4.jpg"
];

const TESTIMONIALS = [
  { name: "Pedro Barreto", text: "Melhor atendimento da região. O degradê ficou impecável!", stars: 5 },
  { name: "Vitor de Pádua", text: "Ambiente sensacional e café de primeira. Recomendo o barbeiro Rafa.", stars: 5 },
  { name: "Pedro Alves", text: "Agendamento super fácil pelo site. Sem filas, nota 10.", stars: 5 }
];
// --- ATÉ AQUI ---

const today = new Date();

const generateTimeSlots = () => {
  const slots = [];
  let current = new Date();
  current.setHours(8, 0, 0); 
  const end = new Date();
  end.setHours(19, 30, 0); 

  while (current <= end) {
    slots.push(current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    current.setMinutes(current.getMinutes() + 10);
  }
  return slots;
};

export default function BookingPage() {
  const tenantId = "f90dcfa6-43ca-4228-8612-db63f5554f17";
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]); 
  const [step, setStep] = useState(0); 
  const [selectedService, setSelectedService] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [existingAppointments, setExistingAppointments] = useState([]); 

  const [bookingError, setBookingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1)); 
  const [selectedFullDate, setSelectedFullDate] = useState(new Date()); 

  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [drawerAnimation, setDrawerAnimation] = useState(false); 
  const [myAppointments, setMyAppointments] = useState([]);
  const [loadingMyApps, setLoadingMyApps] = useState(false);

  const [cancelModal, setCancelModal] = useState({ isOpen: false, appointmentId: null });
  const [limitModal, setLimitModal] = useState(false);

  // NOVO: Estado para controlar o Tema
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Puxa os dados salvos
  const [customerInfo, setCustomerInfo] = useState(() => {
    const saved = localStorage.getItem('barbearia_user');
    return saved ? JSON.parse(saved) : { name: '', customerPhone: '' };
  });

  const [isExistingUser, setIsExistingUser] = useState(() => {
    return !!localStorage.getItem('barbearia_user');
  });

  const handleOpenDrawer = () => {
    fetchUserAppointments();
    setShowMyAppointments(true); 
    setTimeout(() => {
      setDrawerAnimation(true); 
    }, 10);
  };

  const handleCloseDrawer = () => {
    setDrawerAnimation(false); 
    setTimeout(() => {
      setShowMyAppointments(false); 
    }, 300); 
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resBarbers = await axios.get(`https://barbearia-backend-dja2.onrender.com/api/barbers/tenant/${tenantId}`);
        setBarbers(resBarbers.data);
        const resServices = await axios.get(`https://barbearia-backend-dja2.onrender.com/api/services/tenant/${tenantId}`);
        setServices(resServices.data);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedBarber && selectedFullDate) {
      axios.get(`https://barbearia-backend-dja2.onrender.com/api/appointments/barber/${selectedBarber.id}`) 
        .then(res => {
          const dayApps = res.data.filter(app => {
            if (app.status !== 'SCHEDULED') return false;
            if (!app.appointmentTime) return false;
            
            const appDate = new Date(app.appointmentTime);
            return appDate.getDate() === selectedFullDate.getDate() &&
                   appDate.getMonth() === selectedFullDate.getMonth() &&
                   appDate.getFullYear() === selectedFullDate.getFullYear();
          });
          setExistingAppointments(dayApps);
        })
        .catch(err => console.error("Erro ao buscar agenda:", err));
    }
  }, [selectedBarber, selectedFullDate, refreshTrigger]); 

  const fetchUserAppointments = async () => {
    if (!customerInfo.customerPhone) return;
    setLoadingMyApps(true);
    try {
      const res = await axios.get(`https://barbearia-backend-dja2.onrender.com/api/appointments/phone/${encodeURIComponent(customerInfo.customerPhone)}`);
      
      const filtered = res.data.filter(app => 
        app.status === 'SCHEDULED' &&
        new Date(app.appointmentTime) >= new Date()
      ).sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));
      
      setMyAppointments(filtered);
    } catch (err) {
      console.error("Erro ao buscar seus agendamentos", err);
    } finally {
      setLoadingMyApps(false);
    }
  };

  const handleCancelClick = (app) => {
    const idParaDeletar = app.id || app.appointmentId || app.codigo;
    if (!idParaDeletar) return;
    setCancelModal({ isOpen: true, appointmentId: idParaDeletar });
  };

  const confirmCancelAppointment = async () => {
    if (!cancelModal.appointmentId) return;

    try {
      await axios.delete(`https://barbearia-backend-dja2.onrender.com/api/appointments/${cancelModal.appointmentId}`);
      
      setMyAppointments(prev => prev.filter(item => item.id !== cancelModal.appointmentId && item.appointmentId !== cancelModal.appointmentId));
      setCancelModal({ isOpen: false, appointmentId: null });
      setRefreshTrigger(prev => prev + 1); 

    } catch (err) {
      console.error("Erro ao deletar:", err);
      alert("Erro ao cancelar agendamento.");
      setCancelModal({ isOpen: false, appointmentId: null });
    }
  };

  const isSlotBusy = (timeSlot) => {
    if (!selectedFullDate || !selectedService) return false;
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotStart = new Date(selectedFullDate);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + selectedService.durationMinutes * 60000);

    return existingAppointments.some(app => {
      const appStart = new Date(app.appointmentTime);
      const appDuration = app.service?.durationMinutes || 30; 
      const appEnd = new Date(appStart.getTime() + appDuration * 60000); 

      return (slotStart.getTime() < (appEnd.getTime() - 1000) && 
              (slotEnd.getTime() - 1000) > appStart.getTime());
    });
  };

  const nextMonth = () => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    const maxMonthLimit = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    if (next <= maxMonthLimit) setViewDate(next);
  };

  const prevMonth = () => {
    const prev = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) setViewDate(prev);
  };

  const monthName = viewDate.toLocaleString('pt-BR', { month: 'long' });
  const yearName = viewDate.getFullYear();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const handleServiceClick = (service) => { setSelectedService(service); setStep(1); };
  const handleBarberClick = (barber) => { setSelectedBarber(barber); setStep(2); };
  const handleTimeConfirm = () => {
    if (!selectedFullDate || !selectedTime) return alert("Selecione o horário!");
    setBookingError('');
    setStep(3); 
  };

  const finalizeAppointment = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setBookingError('');

    try {
      const normalize = (p) => String(p || '').replace(/\D/g, '');
      const userPhone = normalize(customerInfo.customerPhone);

      const response = await axios.get(`https://barbearia-backend-dja2.onrender.com/api/appointments/phone/${encodeURIComponent(customerInfo.customerPhone)}`);
      const ativosNoMes = response.data.filter(app => {
        const appPhone = normalize(app.customerPhone);
        const appDate = new Date(app.appointmentTime);
        const isSameMonth = appDate.getMonth() === selectedFullDate.getMonth() && 
                           appDate.getFullYear() === selectedFullDate.getFullYear();
        return appPhone === userPhone && app.status === 'SCHEDULED' && isSameMonth;
      });

      if (ativosNoMes.length >= 5) {
        setLimitModal(true);
        setIsSubmitting(false);
        return; 
      }

      const payload = {
        customerName: customerInfo.name,
        customerPhone: customerInfo.customerPhone,
        appointmentTime: `${selectedFullDate.toISOString().split('T')[0]}T${selectedTime}:00`,
        barber: { id: selectedBarber.id },
        service: { id: selectedService.id },
        tenant: { id: tenantId }
      };

      await axios.post('https://barbearia-backend-dja2.onrender.com/api/appointments', payload);
      
      localStorage.setItem('barbearia_user', JSON.stringify(customerInfo));
      setIsExistingUser(true);
      setStep(4);

    } catch (error) {
      console.error("Erro detalhado:", error);

      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 500 || (typeof errorData === 'string' && errorData.includes("Limite atingido"))) {
        setLimitModal(true);
      } else {
        setBookingError("Erro ao processar agendamento. Verifique sua conexão.");
      }
      
      if (step === 3) setStep(2); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setStep(0);
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedTime('');
    setBookingError('');
  };

  const maxAllowedDate = new Date(today);
  maxAllowedDate.setMonth(maxAllowedDate.getMonth() + 1);
  maxAllowedDate.setHours(23, 59, 59, 999);

  return (
    <div className={`min-h-screen font-sans overflow-x-hidden relative transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      <style>{`
        .area-barbeiro { max-width: 1024px; margin: 0 auto; padding: 10px 10px 40px; }
        .seta-gigante { font-size: 50px; color: ${isDarkMode ? '#475569' : '#94a3b8'}; cursor: pointer; transition: 0.3s; }
        .grid-centrado { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin-top: 20px; }
        .card-foda { background: ${isDarkMode ? '#0f172a' : '#ffffff'}; border: 2px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}; border-radius: 20px; padding: 15px; width: 100%; max-width: 280px; text-align: center; cursor: pointer; transition: 0.3s; ${isDarkMode ? '' : 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);'} }
        .card-foda:hover { border-color: #48C0D0; transform: translateY(-5px); ${isDarkMode ? '' : 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);'} }
        .foto-pro { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; border: 3px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}; }
        
        @media (min-width: 350px) {
           .grid-centrado { gap: 20px; }
           .card-foda { border-radius: 24px; padding: 20px; }
           .foto-pro { width: 100px; height: 100px; margin: 0 auto 15px; }
        }

        @media (min-width: 640px) {
          .seta-gigante { font-size: 70px; }
          .grid-centrado { gap: 30px; }
          .card-foda { padding: 30px; }
          .foto-pro { width: 130px; height: 130px; }
        }
      `}</style>

      {/* HEADER */}
      <header className={`border-b w-full relative z-10 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="max-w-5xl mx-auto h-20 min-[350px]:h-24 sm:h-36 flex items-center justify-center relative px-2 min-[350px]:px-4">
          
          {/* BOTÃO MODO CLARO/ESCURO NA ESQUERDA */}
          <div className="absolute left-2 min-[350px]:left-4 sm:left-6 flex items-center z-50">
            <button 
              onClick={toggleTheme}
              className={`p-2 min-[350px]:p-2.5 rounded-full border transition-all cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 shadow-sm'}`}
              aria-label="Alternar Tema"
            >
              {isDarkMode ? (
                // Ícone Sol
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 4.22a1 1 0 011.415 0l.708.708a1 1 0 01-1.414 1.414l-.708-.708a1 1 0 010-1.414zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM14.929 15.636a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-4.22a1 1 0 010-1.415l.708-.708a1 1 0 011.414 1.414l-.708.708a1 1 0 01-1.414 0zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm2.071-5.636a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 5a5 5 0 100 10 5 5 0 000-10z"></path></svg>
              ) : (
                // Ícone Lua
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
              )}
            </button>
          </div>

          {/* LOGO CENTRALIZADA */}
          <div className="flex items-center justify-center">
            <img 
              src="/logo.jpg" 
              alt="Club Du Rafa" 
              className={`h-14 w-14 min-[350px]:h-20 min-[350px]:w-20 sm:h-28 sm:w-28 rounded-full border-2 min-[350px]:border-3 border-[#48C0D0] object-cover shadow-lg transition-all p-1 ${isDarkMode ? '' : 'bg-white'}`}
            />
          </div>

          {/* BOTÃO MEUS HORÁRIOS NA DIREITA */}
          <div className="absolute right-2 min-[350px]:right-4 sm:right-6 flex items-center z-50">
            <button 
              onClick={handleOpenDrawer}
              className="bg-[#48C0D0]/10 hover:bg-[#48C0D0]/20 text-[#48C0D0] border border-[#48C0D0]/20 px-2 py-1.5 min-[350px]:px-3 min-[350px]:py-2 sm:px-4 sm:py-2 rounded-lg min-[350px]:rounded-xl text-[9px] min-[350px]:text-[10px] sm:text-xs font-black uppercase transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">Meus </span>Horários
            </button>
          </div>

        </div>
      </header>

      {/* GAVETA DE MEUS AGENDAMENTOS */}
      {showMyAppointments && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div 
            className={`absolute inset-0 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${drawerAnimation ? 'opacity-100' : 'opacity-0'} ${isDarkMode ? 'bg-black/60' : 'bg-black/40'}`} 
            onClick={handleCloseDrawer}
          ></div>
          
          <div 
            className={`relative w-[90vw] sm:w-full max-w-md h-full shadow-2xl p-4 min-[350px]:p-5 sm:p-8 border-l overflow-y-auto transition-transform duration-300 ease-out transform ${drawerAnimation ? 'translate-x-0' : 'translate-x-full'} ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
          >
            <div className="flex justify-between items-center mb-6 sm:mb-10">
              <h2 className={`text-lg min-[350px]:text-xl sm:text-2xl font-black uppercase italic ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Meus Agendamentos</h2>
              <button onClick={handleCloseDrawer} className={`text-xl sm:text-2xl cursor-pointer ${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>✕</button>
            </div>
            
            {!customerInfo.customerPhone ? (
               <div className="text-center py-20"><p className={`font-bold text-xs sm:text-base ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Você ainda não realizou nenhum agendamento neste dispositivo.</p></div>
            ) : loadingMyApps ? (
              <div className="text-center py-20 text-[#48C0D0] font-bold animate-pulse text-xs sm:text-base">Buscando seus horários...</div>
            ) : myAppointments.length === 0 ? (
              <div className="text-center py-20"><p className={`font-bold uppercase text-[10px] sm:text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Nenhum agendamento futuro encontrado para {customerInfo.name || 'você'}</p></div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {myAppointments.map(app => (
                  <div key={app.id} className={`p-3 min-[350px]:p-4 sm:p-5 rounded-2xl sm:rounded-3xl relative group border ${isDarkMode ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-[9px] sm:text-[10px] font-black text-[#48C0D0] uppercase mb-1">{app.service?.name}</p>
                    <p className={`text-sm min-[350px]:text-base sm:text-lg font-bold mb-1 sm:mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(app.appointmentTime).toLocaleDateString('pt-BR')} às {new Date(app.appointmentTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                    <p className={`text-[9px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Profissional: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{app.barber?.name}</span></p>
                    <button onClick={() => handleCancelClick(app)} className={`mt-3 sm:mt-4 w-full py-2 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all border cursor-pointer ${isDarkMode ? 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border-red-500/20' : 'bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border-red-100'}`}>Cancelar Horário</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* POP-UP DE CANCELAMENTO CUSTOMIZADO */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className={`absolute inset-0 backdrop-blur-sm transition-opacity ${isDarkMode ? 'bg-black/80' : 'bg-black/40'}`}
            onClick={() => setCancelModal({ isOpen: false, appointmentId: null })}
          ></div>
          
          <div className={`relative w-full max-w-sm p-6 sm:p-8 rounded-3xl shadow-2xl text-center animate-in fade-in zoom-in-95 duration-300 border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            
            <h2 className={`text-xl sm:text-2xl font-black italic mb-2 uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cancelar Horário?</h2>
            <p className={`text-xs sm:text-sm mb-8 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Essa ação não pode ser desfeita e você perderá a sua vaga reservada.</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setCancelModal({ isOpen: false, appointmentId: null })} 
                className={`flex-1 font-bold py-3 rounded-xl transition-all text-xs sm:text-sm uppercase cursor-pointer ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                Voltar
              </button>
              <button 
                onClick={confirmCancelAppointment} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 text-xs sm:text-sm uppercase cursor-pointer"
              >
                Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP DE LIMITE MENSAL */}
      {limitModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            className={`absolute inset-0 backdrop-blur-sm transition-opacity ${isDarkMode ? 'bg-black/80' : 'bg-black/40'}`}
            onClick={() => setLimitModal(false)}
          ></div>
          
          <div className={`relative w-full max-w-sm p-6 sm:p-8 rounded-3xl shadow-2xl text-center animate-in fade-in zoom-in-95 duration-300 border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-100'}`}>
              <span className="text-2xl">⚠️</span>
            </div>
            
            <h2 className={`text-xl sm:text-2xl font-black italic mb-2 uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Limite Atingido</h2>
            <p className={`text-xs sm:text-sm mb-8 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Você já atingiu o limite máximo de 5 agendamentos simultâneos, desmarque um agendamento existente, caso deseje agendar outro.</p>
            
            <button 
              onClick={() => setLimitModal(false)} 
              className="w-full bg-[#48C0D0] text-black font-black py-3 rounded-xl transition-all text-xs sm:text-sm uppercase cursor-pointer shadow-lg shadow-[#48C0D0]/20"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* STEP 0 - INFORMAÇÕES E SERVIÇOS */}
      {step === 0 && (
        <main className="max-w-5xl mx-auto px-3 min-[350px]:px-4 py-6 sm:py-10 flex flex-col min-h-[calc(100vh-112px)]">
          
          <div className={`backdrop-blur-md rounded-2xl min-[350px]:rounded-3xl p-4 min-[350px]:p-6 sm:p-8 mb-8 sm:mb-10 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 border transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#319ba9] via-[#48C0D0] to-[#319ba9]"></div>
            
            <div className="grid grid-cols-1 min-[450px]:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-8 relative z-10">
              <div className="flex flex-col gap-1 border-l-2 border-[#48C0D0]/50 pl-3">
                <h3 className="font-black uppercase text-[9px] min-[350px]:text-[10px] sm:text-xs tracking-[0.2em] text-[#48C0D0]">Localização</h3>
                <p className={`text-[11px] sm:text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Quadra QE 32 Conjunto O, 01<br/>Guará II - Brasília/DF</p>
              </div>
              <div className="flex flex-col gap-1 border-l-2 border-[#48C0D0]/50 pl-3">
                <h3 className="font-black uppercase text-[9px] min-[350px]:text-[10px] sm:text-xs tracking-[0.2em] text-[#48C0D0]">Atendimento</h3>
                <p className={`text-[11px] sm:text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>8h às 19:30h<br/>Segunda a Sábado</p>
              </div>
              <div className="flex flex-col gap-1 border-l-2 border-[#48C0D0]/50 pl-3">
                <h3 className="font-black uppercase text-[9px] min-[350px]:text-[10px] sm:text-xs tracking-[0.2em] text-[#48C0D0]">Pagamento</h3>
                <p className={`text-[11px] sm:text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>PIX, Cartão (Créd/Déb)<br/>e Dinheiro</p>
              </div>
              <div className="flex flex-col gap-1 border-l-2 border-[#48C0D0]/50 pl-3">
                <h3 className="font-black uppercase text-[9px] min-[350px]:text-[10px] sm:text-xs tracking-[0.2em] text-[#48C0D0]">Contato</h3>
                <p className={`text-[11px] sm:text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>(61) 98379-1418</p>
              </div>
            </div>
          </div>

          <div className="flex-1 animate-in fade-in duration-700 delay-150">
            <div className="text-center mb-6 sm:mb-10">
              <h1 className={`text-xl min-[350px]:text-2xl sm:text-3xl font-black mb-1 sm:mb-2 italic uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nossos Serviços</h1>
              <p className={`text-xs sm:text-base font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Escolha o que deseja fazer hoje</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 xl:gap-6">
              {services.map(srv => (
                <div 
                  key={srv.id} 
                  onClick={() => handleServiceClick(srv)} 
                  className={`relative overflow-hidden flex justify-between items-center p-3 sm:p-5 xl:p-6 rounded-2xl cursor-pointer transition-all duration-300 group shadow-md hover:shadow-[0_0_15px_rgba(72,192,208,0.1)] hover:-translate-y-0.5 xl:min-h-[100px] border ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800/50 border-slate-800 hover:border-[#48C0D0]/50' : 'bg-white border-slate-200 hover:border-[#48C0D0]/50'}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#48C0D0]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                  
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#48C0D0] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 xl:gap-5 relative z-10 pl-1 group-hover:pl-2 transition-all duration-300">
                    <div className="flex flex-col justify-center">
                      <span className={`font-bold text-sm sm:text-base xl:text-xl transition-colors leading-tight mb-0.5 sm:mb-1 ${isDarkMode ? 'text-slate-200 group-hover:text-[#48C0D0]' : 'text-slate-800 group-hover:text-[#48C0D0]'}`}>{srv.name}</span>
                      <div className={`flex items-center gap-1.5 xl:mt-0.5 transition-colors ${isDarkMode ? 'text-slate-500 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-slate-500'}`}>
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 xl:w-4 xl:h-4 text-[#48C0D0]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span className="text-[10px] sm:text-xs xl:text-sm font-medium">{srv.durationMinutes} min<span className="hidden xl:inline"> de duração</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 shrink-0 ml-2">
                    <span className="text-[#48C0D0] font-black text-[11px] sm:text-sm xl:text-base bg-gradient-to-r from-[#48C0D0]/10 to-transparent px-2.5 py-1.5 sm:px-3 sm:py-2 xl:px-5 xl:py-3 rounded-lg xl:rounded-xl border border-[#48C0D0]/20 group-hover:border-[#48C0D0]/40 group-hover:from-[#48C0D0]/20 transition-all duration-300 block shadow-inner">
                      R$ {srv.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="mt-20 sm:mt-32 space-y-10">
            <div className="text-center">
              <h2 className={`text-2xl sm:text-3xl font-black uppercase italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nosso <span className="text-[#48C0D0]">Estilo</span></h2>
              <div className="h-1 w-16 bg-[#48C0D0] mx-auto mt-2"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {GALLERY_IMAGES.map((img, idx) => (
                <div key={idx} className={`group aspect-[3/4] rounded-2xl overflow-hidden flex items-center justify-center border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <img 
                    src={img} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500" 
                    alt={`Corte ${idx + 1}`}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<span class="text-slate-500 text-xs text-center p-4">Imagem não encontrada</span>';
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className={`mt-20 sm:mt-32 rounded-[32px] p-8 border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((t, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex text-[#48C0D0] text-sm">
                    {Array.from({ length: t.stars }).map((_, i) => <span key={i}>★</span>)}
                  </div>
                  <p className={`text-xs sm:text-sm xl:text-base italic ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>"{t.text}"</p>
                  <p className={`text-[10px] xl:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>— {t.name}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className={`mt-12 sm:mt-16 pt-6 pb-4 text-center animate-in fade-in duration-700 delay-300 border-t ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200'}`}>
            <div className="flex flex-col items-center justify-center gap-4">
              <h2 className="text-[#48C0D0] font-black tracking-widest text-lg uppercase italic">Club Du Rafa</h2>
              <div className="flex gap-4">
                <a href="https://instagram.com/clubdurafa" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={`w-10 h-10 rounded-full flex items-center justify-center hover:text-[#48C0D0] hover:border-[#48C0D0] transition-colors cursor-pointer border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://wa.me/5561983791418" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={`w-10 h-10 rounded-full flex items-center justify-center hover:text-[#25D366] hover:border-[#25D366] transition-colors cursor-pointer border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 space-y-1">
                <p>© {new Date().getFullYear()} Club Du Rafa. Todos os direitos reservados.</p>
                <p>Desenvolvido com foco na sua experiência.</p>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* STEP 1 - PROFISSIONAL */}
      {step === 1 && (
        <div className="area-barbeiro animate-in fade-in duration-700 relative w-full">
          
          <div className="relative flex flex-col items-center justify-center w-full mb-12 mt-16 sm:mt-10">
            
            <button 
              onClick={() => setStep(0)}
              className={`cursor-pointer absolute left-[-10px] sm:left-[-40px] md:left-[-60px] top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full hover:bg-[#48C0D0] hover:text-black hover:border-[#48C0D0] hover:scale-110 transition-all duration-300 shadow-lg z-10 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}
              title="Voltar"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
            </button>

            <h2 className={`text-2xl min-[350px]:text-3xl sm:text-5xl font-black text-center uppercase italic tracking-tight drop-shadow-md ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Escolha o <span className="text-[#48C0D0]">Profissional</span>
            </h2>
            
            <div className="mt-4 px-5 py-1.5 rounded-full bg-[#48C0D0]/10 border border-[#48C0D0]/30 shadow-[0_0_15px_rgba(72,192,208,0.15)] backdrop-blur-sm">
              <p className="text-center text-[#48C0D0] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em]">
                Serviço: {selectedService?.name}
              </p>
            </div>
          </div>

          <div className="grid-centrado">
            {barbers.map((barber) => (
              <div 
                key={barber.id} 
                className="card-foda group relative flex flex-col items-center overflow-hidden" 
                onClick={() => handleBarberClick(barber)}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#48C0D0]/20 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-5 mt-2">
                   <div className={`absolute inset-0 rounded-full border-2 border-dashed group-hover:border-[#48C0D0] group-hover:rotate-180 transition-all duration-1000 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}></div>
                   
                   <img 
                     src={barber.photoUrl || "https://via.placeholder.com/150"} 
                     className="foto-pro absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] object-cover rounded-full shadow-2xl grayscale group-hover:grayscale-0 transition-all duration-500 bg-white" 
                     alt={barber.name} 
                     onError={(e) => e.target.src = "https://via.placeholder.com/150"} 
                   />
                   
                   <div className="absolute bottom-3 right-3 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                </div>
                
                <h3 className={`text-xl sm:text-2xl font-black group-hover:text-[#48C0D0] transition-colors relative z-10 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {barber.name}
                </h3>
                
                <div className="flex items-center gap-1 mt-1 mb-5 relative z-10">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-[#48C0D0] text-xs sm:text-sm drop-shadow-[0_0_5px_rgba(72,192,208,0.5)]">★</span>
                  ))}
                </div>
                
                {/* BOTÃO CORRIGIDO: Sem a seta, mantendo py-2.5 e w-full centralizado */}
                <div className={`w-full py-2.5 rounded-xl group-hover:bg-[#48C0D0] group-hover:border-[#48C0D0] transition-all duration-300 flex items-center justify-center relative z-10 border ${isDarkMode ? 'bg-slate-800/50 border-slate-700 group-hover:text-black text-slate-400' : 'bg-slate-50 border-slate-200 group-hover:text-white text-slate-500'}`}>
                  <span className={`font-black text-[10px] sm:text-xs uppercase tracking-widest transition-colors text-center ${isDarkMode ? 'text-slate-400 group-hover:text-black' : 'text-slate-500 group-hover:text-white'}`}>
                    Selecionar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2 - CALENDÁRIO E HORÁRIOS */}
      {step === 2 && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-950 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black' : 'bg-slate-100/80 backdrop-blur-sm'}`}>
          
          <div className={`w-full max-w-md lg:max-w-4xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col lg:flex-row max-h-[95vh] sm:max-h-[90vh] relative border ${isDarkMode ? 'bg-white border-slate-700/50' : 'bg-white border-slate-200'}`}>
            
            {/* LADO ESQUERDO: CALENDÁRIO (Sempre Dark Mode agora) */}
            <div className="p-4 sm:p-6 lg:p-8 lg:w-1/2 flex flex-col justify-start lg:justify-center shrink-0 relative overflow-hidden z-10 bg-gradient-to-b from-slate-900 to-slate-950">
              <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-48 h-48 bg-[#48C0D0]/10 blur-[50px] rounded-full pointer-events-none"></div>

              <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8 relative z-10">
                <button onClick={prevMonth} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-transparent rounded-full transition-all cursor-pointer hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] sm:text-xs font-black text-[#48C0D0] uppercase tracking-[0.2em] mb-1">Selecione a Data</span>
                  <h2 className="text-base sm:text-xl lg:text-2xl font-bold capitalize text-center drop-shadow-md text-white">{monthName} {yearName}</h2>
                </div>
                <button onClick={nextMonth} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-transparent rounded-full transition-all cursor-pointer hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[9px] sm:text-[10px] font-black mb-3 sm:mb-5 tracking-widest relative z-10 text-slate-500">
                <span>DOM</span><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span>
              </div>
              
              <div className="grid grid-cols-7 text-center gap-y-1 sm:gap-y-2 lg:gap-y-3 text-[11px] sm:text-sm lg:text-base relative z-10">
                {[...Array(firstDayOfMonth)].map((_, i) => <span key={i}></span>)}
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                  const isPast = dateObj < new Date(today).setHours(0,0,0,0);
                  const isTooFar = dateObj > maxAllowedDate;
                  const isDisabled = isPast || isTooFar;
                  const isSelected = selectedFullDate && selectedFullDate.getDate() === day && selectedFullDate.getMonth() === viewDate.getMonth() && selectedFullDate.getFullYear() === viewDate.getFullYear();
                  const isTodayDate = dateObj.getDate() === today.getDate() && dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();

                  return (
                    <div key={day} className="relative flex justify-center items-center h-8 w-full sm:h-10 lg:h-12">
                      {isTodayDate && !isSelected && (
                        <div className="absolute bottom-0 w-1 h-1 lg:w-1.5 lg:h-1.5 bg-[#48C0D0] rounded-full"></div>
                      )}
                      <button 
                        disabled={isDisabled} 
                        onClick={() => setSelectedFullDate(dateObj)} 
                        className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-full font-bold transition-all relative z-10
                          ${isDisabled ? 'cursor-not-allowed opacity-20 text-slate-500' : 'cursor-pointer hover:bg-slate-800 hover:text-white text-slate-300'} 
                          ${isSelected && !isDisabled ? 'bg-[#48C0D0] text-black shadow-[0_0_15px_rgba(72,192,208,0.4)] scale-110' : ''}
                        `}>
                        {day}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LADO DIREITO: HORÁRIOS */}
            <div className="bg-white flex-1 overflow-hidden flex flex-col relative z-20 rounded-t-[24px] sm:rounded-t-[32px] lg:rounded-t-none lg:rounded-l-[32px] -mt-4 lg:mt-0 shadow-[0_-10px_20px_rgba(0,0,0,0.2)] lg:shadow-[-10px_0_20px_rgba(0,0,0,0.2)] lg:w-1/2">
              
              <div className="px-4 sm:px-6 pt-5 sm:pt-6 lg:pt-8">
                <div className="p-3 sm:p-4 bg-white border border-slate-100 rounded-[20px] flex flex-col gap-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:border-[#48C0D0]/30 transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#48C0D0]/10 to-transparent rounded-bl-full -z-0"></div>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase mb-0.5 tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#48C0D0]"></span>
                        Resumo do Agendamento
                      </p>
                      <p className="font-black text-slate-800 text-sm sm:text-base leading-tight">{selectedService?.name}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-50 pl-1.5 pr-3 py-1.5 rounded-full border border-slate-100">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                        <img src={selectedBarber?.photoUrl || "https://via.placeholder.com/150"} alt="Barbeiro" className="w-full h-full object-cover bg-white"/>
                      </div>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-700 truncate max-w-[80px]">{selectedBarber?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="min-h-[150px] sm:min-h-[200px] w-full">
                  {(() => {
                    const availableSlots = generateTimeSlots().filter(time => {
                      if (!selectedFullDate) return false;
                      const [hours, minutes] = time.split(':');
                      const slotDate = new Date(selectedFullDate);
                      slotDate.setHours(parseInt(hours), parseInt(minutes), 0);
                      if (slotDate < new Date()) return false;
                      return !isSlotBusy(time);
                    });

                    if (availableSlots.length > 0) {
                      return (
                        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                          {availableSlots.map(time => (
                            <button 
                              key={time} 
                              onClick={() => setSelectedTime(time)} 
                              className={`py-3 sm:py-3.5 border-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5
                                ${selectedTime === time 
                                  ? 'bg-[#48C0D0] border-[#48C0D0] text-white shadow-lg shadow-[#48C0D0]/30 scale-[1.02]' 
                                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-[#48C0D0]/50 hover:bg-white hover:text-[#48C0D0]'}`
                              }>
                              <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              {time}
                            </button>
                          ))}
                        </div>
                      );
                    } else {
                      return (
                        <div className="h-full min-h-[150px] sm:min-h-[200px] flex flex-col items-center justify-center bg-slate-50 rounded-[20px] border-2 border-dashed border-slate-200 p-6">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <span className="text-2xl opacity-60">✂️</span>
                          </div>
                          <p className="text-sm font-black text-slate-700 text-center mb-1">Agenda Lotada!</p>
                          <p className="text-[11px] sm:text-xs font-medium text-slate-400 text-center leading-relaxed">
                            Não temos mais horários disponíveis para este dia. Escolha outra data acima.
                          </p>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {bookingError && (
                <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold text-center animate-in fade-in zoom-in-95">
                  ⚠️ {bookingError}
                </div>
              )}

              <div className="p-4 sm:p-6 lg:p-8 border-t border-slate-100 bg-white grid grid-cols-2 gap-3 sm:gap-4 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] relative z-30">
                <button 
                  onClick={() => setStep(1)} 
                  className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[11px] sm:text-xs uppercase transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  Voltar
                </button>
                
                <button 
                  onClick={handleTimeConfirm} 
                  disabled={!selectedTime}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[11px] sm:text-xs uppercase transition-all 
                    ${selectedTime 
                      ? 'bg-slate-900 text-white hover:bg-[#48C0D0] shadow-lg hover:shadow-[#48C0D0]/30 cursor-pointer' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-transparent'}`
                  }
                >
                  Confirmar
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* STEP 3 - FORMULÁRIO */}
      {step === 3 && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 min-[350px]:p-4 animate-in fade-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100/80 backdrop-blur-sm'}`}>
          <div className={`w-full max-w-md p-5 min-[350px]:p-6 sm:p-10 rounded-2xl min-[350px]:rounded-3xl sm:rounded-[40px] shadow-2xl overflow-y-auto max-h-[95vh] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-xl min-[350px]:text-2xl sm:text-3xl font-black italic mb-3 min-[350px]:mb-4 sm:mb-2 text-center uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>QUASE LÁ!</h2>
            
            <form onSubmit={finalizeAppointment} className="space-y-3 min-[350px]:space-y-4 sm:space-y-6">
              
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[9px] min-[350px]:text-[10px] sm:text-xs font-black text-[#48C0D0] uppercase ml-1">
                  Nome Completo {isExistingUser && <span className={`text-[8px] sm:text-[10px] ml-1 lowercase font-medium px-1.5 py-0.5 rounded border ${isDarkMode ? 'text-slate-500 border-slate-700 bg-slate-800' : 'text-slate-400 border-slate-200 bg-slate-50'}`}>(salvo)</span>}
                </label>
                <input 
                  required 
                  readOnly={isExistingUser}
                  value={customerInfo.name} 
                  onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} 
                  className={`w-full rounded-lg min-[350px]:rounded-xl sm:rounded-2xl p-2.5 min-[350px]:p-3 sm:p-4 text-xs min-[350px]:text-sm sm:text-base font-bold outline-none focus:ring-2 focus:ring-[#48C0D0] border ${isDarkMode ? (isExistingUser ? 'bg-slate-800/50 text-slate-400 cursor-not-allowed border-transparent' : 'bg-slate-800 text-white border-transparent') : (isExistingUser ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white text-slate-900 border-slate-200')}`} 
                  placeholder="Seu nome..." 
                />
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[9px] min-[350px]:text-[10px] sm:text-xs font-black text-[#48C0D0] uppercase ml-1">
                  WhatsApp {isExistingUser && <span className={`text-[8px] sm:text-[10px] ml-1 lowercase font-medium px-1.5 py-0.5 rounded border ${isDarkMode ? 'text-slate-500 border-slate-700 bg-slate-800' : 'text-slate-400 border-slate-200 bg-slate-50'}`}>(salvo)</span>}
                </label>
                <input 
                  required 
                  readOnly={isExistingUser}
                  value={customerInfo.customerPhone} 
                  onChange={e => setCustomerInfo({...customerInfo, customerPhone: e.target.value})} 
                  className={`w-full rounded-lg min-[350px]:rounded-xl sm:rounded-2xl p-2.5 min-[350px]:p-3 sm:p-4 text-xs min-[350px]:text-sm sm:text-base font-bold outline-none focus:ring-2 focus:ring-[#48C0D0] border ${isDarkMode ? (isExistingUser ? 'bg-slate-800/50 text-slate-400 cursor-not-allowed border-transparent' : 'bg-slate-800 text-white border-transparent') : (isExistingUser ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white text-slate-900 border-slate-200')}`} 
                  placeholder="(00) 00000-0000" 
                />
              </div>
              
              <div className={`p-4 sm:p-6 rounded-xl min-[350px]:rounded-2xl sm:rounded-3xl border space-y-1 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[8px] min-[350px]:text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase">Resumo</p>
                <p className="font-bold text-[#48C0D0] text-sm min-[350px]:text-base sm:text-lg leading-tight">{selectedService?.name}</p>
                <p className={`text-[10px] min-[350px]:text-xs sm:text-sm ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{selectedBarber?.name} • {selectedFullDate?.toLocaleDateString()} • {selectedTime}</p>
              </div>

              {bookingError && (
                <div className={`p-2 min-[350px]:p-3 sm:p-4 rounded-lg sm:rounded-xl text-center animate-in fade-in zoom-in duration-300 border ${isDarkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-100'}`}>
                  <p className="text-red-400 font-bold text-[10px] min-[350px]:text-xs sm:text-sm leading-tight">{bookingError}</p>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className={`w-full ${isSubmitting ? 'bg-[#48C0D0]/40 text-[#0d3439] cursor-not-allowed' : 'bg-[#48C0D0] hover:bg-[#5cd5e5] text-slate-950 cursor-pointer'} font-black py-3 min-[350px]:py-4 sm:py-5 rounded-lg min-[350px]:rounded-xl sm:rounded-2xl transition-all shadow-lg uppercase text-[10px] min-[350px]:text-xs sm:text-base`}>
                {isSubmitting ? 'Verificando...' : 'Finalizar Agora'}
              </button>
              
              <button type="button" onClick={() => setStep(2)} className="w-full text-slate-500 font-bold text-[10px] min-[350px]:text-xs sm:text-sm cursor-pointer uppercase mt-1 sm:mt-2 hover:text-slate-400 transition-colors">Ajustar horário</button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 4 - SUCESSO */}
      {step === 4 && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 min-[350px]:p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100/80 backdrop-blur-sm'}`}>
          <div className={`w-full max-w-md p-5 min-[350px]:p-6 sm:p-10 rounded-2xl min-[350px]:rounded-3xl sm:rounded-[40px] shadow-2xl text-center animate-in fade-in duration-500 border ${isDarkMode ? 'bg-slate-900 border-[#48C0D0]/30' : 'bg-white border-[#48C0D0]/30'}`}>
            
            <div className={`w-12 h-12 min-[350px]:w-16 min-[350px]:h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-3 min-[350px]:mb-4 sm:mb-6 border ${isDarkMode ? 'bg-[#48C0D0]/10 border-[#48C0D0]/20' : 'bg-blue-50 border-blue-100'}`}>
              <svg className="w-6 h-6 min-[350px]:w-8 min-[350px]:h-8 sm:w-10 sm:h-10 text-[#48C0D0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>

            <h2 className={`text-xl min-[350px]:text-2xl sm:text-3xl font-black italic mb-1 min-[350px]:mb-2 uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Tudo Certo!</h2>
            <p className={`text-[10px] min-[350px]:text-xs sm:text-sm mb-4 min-[350px]:mb-6 sm:mb-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Seu horário foi reservado com sucesso.</p>

            <div className={`p-4 min-[350px]:p-5 sm:p-6 rounded-xl min-[350px]:rounded-2xl sm:rounded-3xl border space-y-1.5 min-[350px]:space-y-2 sm:space-y-3 text-left mb-4 min-[350px]:mb-6 sm:mb-8 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[8px] min-[350px]:text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1">Detalhes da Reserva</p>
              <p className="font-black text-[#48C0D0] text-base min-[350px]:text-lg sm:text-xl leading-tight">{selectedService?.name}</p>
              
              <div className="flex items-center gap-2 pt-1 sm:pt-2">
                <div className={`w-5 h-5 min-[350px]:w-6 min-[350px]:h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden shrink-0 border ${isDarkMode ? 'border-slate-700' : 'border-slate-200 bg-white'}`}>
                  <img src={selectedBarber?.photoUrl || "https://via.placeholder.com/150"} alt="Barbeiro" className="w-full h-full object-cover"/>
                </div>
                <p className={`text-[10px] min-[350px]:text-xs sm:text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Com <span className="font-bold">{selectedBarber?.name}</span></p>
              </div>

              <div className={`pt-2 mt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <p className={`text-[10px] min-[350px]:text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  📅 {selectedFullDate?.toLocaleDateString('pt-BR')} às <span className="text-[#48C0D0] font-black">{selectedTime}</span>
                </p>
              </div>
            </div>

            <button onClick={resetBooking} className={`w-full font-black py-3 min-[350px]:py-4 sm:py-5 rounded-lg min-[350px]:rounded-xl sm:rounded-2xl transition-all shadow-lg uppercase cursor-pointer text-[10px] min-[350px]:text-xs sm:text-base ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>
              Voltar ao Início
            </button>
          </div>
        </div>
      )}

    </div>
  );
}