import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminPanel() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('AGENDA'); 
  const [filter, setFilter] = useState('HOJE'); 
  const [removingId, setRemovingId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date()); // Estado para o relógio em tempo real
  const tenantId = "f90dcfa6-43ca-4228-8612-db63f5554f17";

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  useEffect(() => {
    loadDashboard();
    
    // Relógio que atualiza a cada 10 segundos para checar os botões e pop-ups
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkPendingServices(now);
    }, 10000);

    const interval = setInterval(loadDashboard, 30000); 
    
    return () => {
      clearInterval(timer);
      clearInterval(interval);
    };
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await axios.get(`http://localhost:8080/api/appointments/tenant/${tenantId}`);
      const sorted = res.data.sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime));
      setAppointments(sorted);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingServices = (now) => {
    appointments.forEach(app => {
      if (app.status === 'SCHEDULED') {
        const endTime = new Date(app.endTime);
        if (now > endTime) {
          const confirm = window.confirm(
            `ATENÇÃO: O serviço de ${app.customerName} deveria ter terminado às ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Deseja finalizar agora?`
          );
          if (confirm) handleComplete(app.id);
        }
      }
    });
  };

  const handleComplete = async (id) => {
    setRemovingId(id);
    setTimeout(async () => {
      try {
        await axios.patch(`http://localhost:8080/api/appointments/${id}/complete`);
        loadDashboard();
        setRemovingId(null);
      } catch (error) {
        alert("Erro ao finalizar atendimento.");
        setRemovingId(null);
      }
    }, 500);
  };

  // --- LÓGICA DE FILTRAGEM ---
  const filteredAgenda = appointments.filter(app => {
    if (app.status !== 'SCHEDULED') return false;
    const appDate = new Date(app.appointmentTime).toLocaleDateString();
    const todayStr = new Date().toLocaleDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString();

    if (filter === 'HOJE') return appDate === todayStr;
    if (filter === 'AMANHA') return appDate === tomorrowStr;
    return true; 
  });

  const completedToday = appointments.filter(app => {
    const appDate = new Date(app.appointmentTime).toLocaleDateString();
    const todayStr = new Date().toLocaleDateString();
    return app.status === 'COMPLETED' && appDate === todayStr;
  });

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0,0,0,0));
    const data = { moneyToday: 0, countToday: 0, services: {} };

    appointments.forEach(app => {
      const d = new Date(app.appointmentTime);
      if (app.status === 'COMPLETED' && d >= startOfDay) {
        data.moneyToday += app.service.price;
        data.countToday++;
        data.services[app.service.name] = (data.services[app.service.name] || 0) + 1;
      }
    });

    const serviceData = Object.keys(data.services).map(name => ({ name, value: data.services[name] }));
    return { ...data, serviceData };
  }, [appointments]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black italic text-2xl animate-pulse">CARREGANDO SISTEMA...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-emerald-500 italic uppercase">PAINEL CLUB DU RAFA</h1>
            <div className="flex gap-6 mt-6 border-b border-slate-800">
              {['AGENDA', 'CONCLUIDOS', 'STATUS'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${activeTab === tab ? 'border-b-2 border-emerald-500 text-white' : 'text-slate-500'}`}
                >
                  {tab === 'CONCLUIDOS' ? 'Concluídos' : tab === 'STATUS' ? 'Estatísticas' : 'Agenda'}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'AGENDA' && (
             <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
                {['HOJE', 'AMANHA', 'TODOS'].map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${filter === f ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'}`}>{f}</button>
                ))}
             </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        
        {/* ABA 1: AGENDA ATIVA */}
        {activeTab === 'AGENDA' && (
          <div className="grid gap-4 animate-in fade-in duration-500">
            {filteredAgenda.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/30 rounded-[40px] border-2 border-dashed border-slate-800">
                <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Nenhum agendamento pendente</p>
              </div>
            ) : (
              filteredAgenda.map((app) => {
                // TRAVA DE HORÁRIO: Verifica se já deu a hora de início
                const appStartTime = new Date(app.appointmentTime);
                const isStarted = currentTime >= appStartTime;

                return (
                  <div 
                    key={app.id} 
                    className={`bg-slate-900 border border-slate-800 p-6 rounded-[32px] flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-500 transform
                    ${removingId === app.id ? 'translate-x-full opacity-0 scale-95' : 'translate-x-0'}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="bg-slate-950 px-5 py-4 rounded-3xl text-center min-w-[110px] border border-slate-800 shadow-inner">
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Início</p>
                        <p className="text-2xl font-black text-white">
                          {new Date(app.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white">{app.customerName}</h3>
                        <p className="text-slate-400 font-bold text-sm">
                          {app.service.name} • <span className="text-emerald-500">{app.barber.name}</span>
                        </p>
                        <p className="text-[10px] text-slate-600 font-bold uppercase mt-1 italic">
                           Fim previsto: {new Date(app.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* LÓGICA DO BOTÃO: Só aparece se isStarted for true */}
                    {isStarted ? (
                      <button 
                        onClick={() => handleComplete(app.id)} 
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-xs transition-all cursor-pointer shadow-lg active:scale-95 whitespace-nowrap animate-in zoom-in duration-300"
                      >
                        FINALIZAR ATENDIMENTO
                      </button>
                    ) : (
                      <div className="px-6 py-3 border border-slate-800 rounded-2xl bg-slate-950/50">
                         <p className="text-[10px] font-black text-slate-600 uppercase tracking-tighter italic">Aguardando Horário...</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ABA 2: CONCLUÍDOS DO DIA */}
        {activeTab === 'CONCLUIDOS' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-emerald-500 font-black uppercase text-sm tracking-widest">Histórico de Hoje</h2>
                <span className="bg-slate-900 px-4 py-2 rounded-full border border-slate-800 text-xs font-bold text-slate-400">
                    {completedToday.length} Atendimentos
                </span>
            </div>
            {completedToday.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/10 rounded-[40px] border-2 border-dashed border-slate-800">
                <p className="text-slate-500 font-black uppercase text-xs tracking-widest">Nada finalizado ainda hoje</p>
              </div>
            ) : (
              completedToday.map((app) => (
                <div key={app.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-[32px] flex items-center justify-between opacity-70">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 font-bold">
                        ✓
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-200">{app.customerName}</h3>
                      <p className="text-xs text-slate-500">{app.service.name} • Finalizado às {new Date(app.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-500 font-black">R$ {app.service.price.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA 3: ESTATÍSTICAS (STATUS) */}
        {activeTab === 'STATUS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl text-center">
                  <p className="text-slate-500 font-black text-[10px] uppercase mb-2 tracking-widest">Receita de Hoje</p>
                  <p className="text-6xl font-black text-emerald-500 tracking-tighter">R$ {stats.moneyToday.toFixed(2)}</p>
                </div>
                <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl text-center">
                  <p className="text-slate-500 font-black text-[10px] uppercase mb-2 tracking-widest">Total de Cortes</p>
                  <p className="text-6xl font-black text-blue-500 tracking-tighter">{stats.countToday}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
              <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl">
                <h3 className="text-lg font-black italic mb-6 text-slate-300 uppercase tracking-tighter">Mix de Serviços</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.serviceData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {stats.serviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }} 
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl">
                <h3 className="text-lg font-black italic mb-6 text-slate-300 uppercase tracking-tighter">Desempenho Diário</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Hoje', total: stats.moneyToday }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" />
                      <Tooltip 
                        cursor={{fill: '#1e293b'}} 
                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} 
                      />
                      <Bar dataKey="total" fill="#10b981" radius={[10, 10, 0, 0]} barSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}