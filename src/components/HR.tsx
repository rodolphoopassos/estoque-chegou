import React, { useState } from 'react';
import { 
  Users, 
  CalendarCheck, 
  UserCog, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2,
  XCircle,
  Save,
  X,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useHR, Employee, Presence } from '../hooks/useHR';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface HRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Omit<Employee, 'id'>) => void;
  employeeToEdit?: Employee | null;
  roles: string[];
  setRoles: React.Dispatch<React.SetStateAction<string[]>>;
}

function EmployeeModal({ isOpen, onClose, onSave, employeeToEdit, roles, setRoles }: HRModalProps) {
  const [formData, setFormData] = useState({
    name: employeeToEdit?.name || '',
    role: employeeToEdit?.role || '',
    status: employeeToEdit?.status || 'active',
    valor_diaria: employeeToEdit?.valor_diaria || 80,
  });

  const [isManagingRoles, setIsManagingRoles] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [editingRoleIndex, setEditingRoleIndex] = useState<number | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Omit<Employee, 'id'>);
    onClose();
  };

  const handleAddRole = () => {
    if (newRole.trim()) {
      setRoles([...roles, newRole.trim()]);
      setNewRole('');
    }
  };

  const handleSaveRole = (index: number) => {
    if (editingRoleValue.trim()) {
      const updatedRoles = [...roles];
      updatedRoles[index] = editingRoleValue.trim();
      setRoles(updatedRoles);
      setEditingRoleIndex(null);
    }
  };

  const handleDeleteRole = (index: number) => {
    const updatedRoles = roles.filter((_, i) => i !== index);
    setRoles(updatedRoles);
  };

  if (isManagingRoles) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <h3 className="font-black uppercase tracking-widest text-slate-700">
              Gerenciar Funções
            </h3>
            <button onClick={() => setIsManagingRoles(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Nova função"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
              <button
                onClick={handleAddRole}
                disabled={!newRole.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Criar
              </button>
            </div>

            <div className="space-y-2 mt-4 max-h-64 overflow-y-auto pr-2">
              {roles.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  {editingRoleIndex === i ? (
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        value={editingRoleValue}
                        onChange={(e) => setEditingRoleValue(e.target.value)}
                        className="flex-1 bg-white border border-indigo-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                      />
                      <button onClick={() => handleSaveRole(i)} className="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase">Salvar</button>
                      <button onClick={() => setEditingRoleIndex(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-700">{r}</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            setEditingRoleIndex(i);
                            setEditingRoleValue(r);
                          }} 
                          className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteRole(i)} 
                          className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase tracking-widest"
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setIsManagingRoles(false)}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-md transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h3 className="font-black uppercase tracking-widest text-slate-700">
            {employeeToEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Função</label>
              <button 
                type="button" 
                onClick={() => setIsManagingRoles(true)}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Gerenciar Funções
              </button>
            </div>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium appearance-none"
              required
            >
              <option value="" disabled>Selecione uma função</option>
              {roles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Valor da Diária (R$)</label>
            <input
              type="number"
              min="0"
              value={formData.valor_diaria}
              onChange={(e) => setFormData({ ...formData, valor_diaria: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium appearance-none"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-md transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalendarModal({ 
  isOpen, 
  onClose, 
  employee, 
  workedDates, 
  setWorkedDates,
  setClosingData,
  currentDate
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  employee: Employee | null,
  workedDates: Record<string, number[]>,
  setWorkedDates: React.Dispatch<React.SetStateAction<Record<string, number[]>>>,
  setClosingData: React.Dispatch<React.SetStateAction<Record<string, { daysWorked: number, dailyRate: number, status: 'pending' | 'paid'}>>>,
  currentDate: Date
}) {
  if (!isOpen || !employee) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday

  const empWorkedDays = workedDates[employee.id] || [];

  const toggleDay = (day: number) => {
    setWorkedDates(prev => {
      const current = prev[employee.id] || [];
      const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
      
      setClosingData(c => ({
        ...c, 
        [employee.id]: {
          ...(c[employee.id] || { dailyRate: 0, status: 'pending' }),
          daysWorked: next.length
        }
      }));
      return { ...prev, [employee.id]: next };
    });
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h3 className="font-black uppercase tracking-widest text-slate-700">
            Dias Trabalhados: {employee.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {blanks.map(b => (
              <div key={`blank-${b}`} className="h-10" />
            ))}
            {days.map(day => {
              const isWorked = empWorkedDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "h-10 w-full rounded-lg font-bold text-sm transition-colors",
                    isWorked 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
             <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Total de Dias</span>
             <span className="text-2xl font-black text-indigo-700">{empWorkedDays.length}</span>
          </div>
          <div className="mt-4 flex justify-end">
             <button
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-md transition-colors"
             >
               Fechar
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HR() {
  const { employees, presences, loading, addEmployee, updateEmployee, deleteEmployee, savePresences } = useHR();
  const [activeTab, setActiveTab] = useState<'attendance' | 'team' | 'payments'>('attendance');
  
  const [roles, setRoles] = useState<string[]>(['Pizzaiolo', 'Atendente', 'Motoboy', 'Gerente', 'Auxiliar']);

  // Attendance state for today: Map of employeeId -> boolean (present)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);

  // Initialize today's attendance from Firestore
  const todayStr = new Date().toISOString().split('T')[0];
  React.useEffect(() => {
    if (!loading) {
      const currentAttendance: Record<string, boolean> = {};
      presences.forEach(p => {
        if (p.data === todayStr) {
          currentAttendance[p.funcionarioId] = p.presente;
        }
      });
      setAttendance(currentAttendance);
    }
  }, [presences, loading, todayStr]);

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [employeeForCalendar, setEmployeeForCalendar] = useState<Employee | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const activeEmployees = employees.filter(e => e.status === 'active');

  const handleToggleAttendance = (id: string) => {
    setAttendance(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSaveAttendance = async () => {
    try {
      const presencesData = activeEmployees.map(emp => ({
        funcionarioId: emp.id,
        presente: !!attendance[emp.id]
      }));
      await savePresences(todayStr, presencesData);
      alert('Presenças salvas com sucesso no banco de dados!');
    } catch (e) {
      alert('Erro ao salvar presenças.');
    }
  };

  const handleSaveEmployee = async (empData: Omit<Employee, 'id'>) => {
    if (employeeToEdit) {
      await updateEmployee(employeeToEdit.id, empData);
    } else {
      await addEmployee(empData);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este funcionário?')) {
      await deleteEmployee(id);
    }
  };

  const openEditModal = (employee: Employee) => {
    setEmployeeToEdit(employee);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEmployeeToEdit(null);
    setIsModalOpen(true);
  };

  // Payments data
  const [closingData, setClosingData] = useState<Record<string, { daysWorked: number, dailyRate: number, status: 'pending' | 'paid'}>>({});
  
  // Update closing data and workedDates based on real presences
  const [workedDates, setWorkedDates] = useState<Record<string, number[]>>({});

  React.useEffect(() => {
    if (!loading) {
      const newWorkedDates: Record<string, number[]> = {};
      const newClosingData: typeof closingData = { ...closingData };
      
      const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      presences.forEach(p => {
         if (p.presente && p.data.startsWith(currentMonthStr)) {
           const day = parseInt(p.data.split('-')[2]);
           if (!newWorkedDates[p.funcionarioId]) newWorkedDates[p.funcionarioId] = [];
           if (!newWorkedDates[p.funcionarioId].includes(day)) {
               newWorkedDates[p.funcionarioId].push(day);
           }
         }
      });

      employees.forEach(emp => {
        const daysW = newWorkedDates[emp.id]?.length || 0;
        newClosingData[emp.id] = {
           daysWorked: daysW,
           dailyRate: emp.valor_diaria || 0,
           status: closingData[emp.id]?.status || 'pending'
        };
      });

      setWorkedDates(newWorkedDates);
      setClosingData(newClosingData);
    }
  }, [presences, employees, loading, currentDate]);

  const calculateDaysWorked = (empId: string) => {
    return presences.filter(p => p.funcionarioId === empId && p.presente).length;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 bg-slate-50 min-h-full p-2 sm:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-800 uppercase flex items-center gap-2">
            <Users className="text-indigo-600" size={24} />
            Recursos Humanos
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Gestão de equipe e controle de ponto
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('attendance')}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all",
              activeTab === 'attendance'
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <CalendarCheck size={16} /> Diário
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all",
              activeTab === 'team'
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <UserCog size={16} /> Equipe
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all",
              activeTab === 'payments'
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Wallet size={16} /> Fechamento
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] overflow-hidden">
        
        {/* TAB 1: Attendance */}
        {activeTab === 'attendance' && (
          <div className="animate-in fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                Ponto do Expediente
              </h3>
              <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>
            </div>
            
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
              {activeEmployees.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-bold">Nenhum funcionário ativo cadastrado.</div>
              ) : (
                <div className="space-y-3">
                  {activeEmployees.map((emp) => {
                    const isPresent = !!attendance[emp.id];
                    return (
                      <div 
                        key={emp.id} 
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none",
                          isPresent 
                            ? "border-emerald-500/30 bg-emerald-900/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                            : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                        )}
                        onClick={() => handleToggleAttendance(emp.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-colors border-2",
                            isPresent 
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                              : "bg-slate-800 text-slate-500 border-transparent"
                          )}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className={cn(
                              "font-black text-lg transition-colors",
                              isPresent ? "text-emerald-400" : "text-slate-200"
                            )}>{emp.name}</p>
                            <p className={cn(
                              "text-xs font-bold uppercase tracking-widest transition-colors",
                              isPresent ? "text-emerald-600/80" : "text-slate-500"
                            )}>
                              {emp.role}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-xs font-black uppercase tracking-widest transition-colors hidden sm:inline-block",
                            isPresent ? "text-emerald-500" : "text-slate-600"
                          )}>
                            {isPresent ? 'Presente' : 'Ausente'}
                          </span>
                          
                          {/* Custom Toggle Switch */}
                          <div className={cn(
                            "w-14 h-8 rounded-full relative transition-colors duration-300",
                            isPresent ? "bg-emerald-500" : "bg-slate-800 border-2 border-slate-700"
                          )}>
                            <div className={cn(
                              "absolute top-0.5 left-0.5 bg-white w-6 h-6 rounded-full shadow-sm transition-transform duration-300 flex items-center justify-center",
                              isPresent ? "translate-x-6 top-1 left-1" : "translate-x-0"
                            )}>
                              {isPresent ? <CheckCircle2 size={14} className="text-emerald-500" /> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-8">
                    <button
                      onClick={handleSaveAttendance}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Salvar Presenças de Hoje
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Team Management */}
        {activeTab === 'team' && (
          <div className="animate-in fade-in flex flex-col h-full min-h-[500px]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                Quadro de Funcionários
              </h3>
              <button
                onClick={openNewModal}
                className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Adicionar</span>
              </button>
            </div>
            
            <div className="p-0 sm:p-4 flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-xs font-black uppercase tracking-widest text-slate-400">
                      <th className="py-4 px-6">Funcionário</th>
                      <th className="py-4 px-4">Função</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 font-bold">Nenhum funcionário cadastrado.</td>
                      </tr>
                    ) : employees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-800">{emp.name}</div>
                        </td>
                        <td className="py-4 px-4 text-sm font-medium text-slate-600">
                          {emp.role}
                        </td>
                        <td className="py-4 px-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                            emp.status === 'active' 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-slate-100 text-slate-500"
                          )}>
                            {emp.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Payments / Closing */}
        {activeTab === 'payments' && (
          <div className="animate-in fade-in flex flex-col h-full min-h-[500px]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                Fechamento Mensal
              </h3>
              
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-slate-700 w-28 text-center uppercase tracking-widest">
                  {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            
            <div className="p-0 sm:p-4 flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-xs font-black uppercase tracking-widest text-slate-400">
                      <th className="py-4 px-6">Funcionário</th>
                      <th className="py-4 px-4 text-center">Dias Trabalhados</th>
                      <th className="py-4 px-4 text-right">Valor Diária</th>
                      <th className="py-4 px-4 text-right">Total a Pagar</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">Nenhum funcionário ativo cadastrado.</td>
                      </tr>
                    ) : activeEmployees.map(emp => {
                      const data = closingData[emp.id] || { daysWorked: 0, dailyRate: emp.valor_diaria || 0, status: 'pending' };
                      const total = data.daysWorked * data.dailyRate;
                      
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="py-4 px-6">
                            <button
                              onClick={() => {
                                setEmployeeForCalendar(emp);
                                setIsCalendarModalOpen(true);
                              }}
                              className="text-left group/btn"
                            >
                              <div className="font-bold text-indigo-700 group-hover/btn:underline flex items-center gap-2">
                                {emp.name}
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{emp.role}</div>
                            </button>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <input 
                              type="number"
                              min="0"
                              max="31"
                              value={data.daysWorked}
                              disabled // Just showing calc from db
                              className="w-16 text-center font-black text-slate-700 bg-slate-100 border border-slate-200 rounded px-2 py-1 cursor-not-allowed"
                            />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400 text-xs font-bold">R$</span>
                              <input 
                                type="number"
                                value={data.dailyRate}
                                disabled
                                className="w-20 text-right font-black text-slate-700 bg-slate-100 border border-slate-200 rounded px-2 py-1 cursor-not-allowed"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-black text-indigo-700 text-lg">
                              {formatCurrency(total)}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                              data.status === 'paid' 
                                ? "bg-emerald-100 text-emerald-700" 
                                : "bg-amber-100 text-amber-700"
                            )}>
                              {data.status === 'paid' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={async () => {
                                if (data.status === 'pending') {
                                  try {
                                    const mesRef = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                                    await addDoc(collection(db, 'transacoes'), {
                                      tipo: 'despesa',
                                      categoria: 'rh',
                                      valor: total,
                                      descricao: 'Pagamento ' + emp.name + ' - ' + mesRef,
                                      data: new Date().toISOString()
                                    });
                                    setClosingData({...closingData, [emp.id]: {...data, status: 'paid'}});
                                    alert(`Pagamento de ${formatCurrency(total)} lançado para ${emp.name}!`);
                                  } catch (e) {
                                    alert('Erro ao lançar.');
                                    console.error(e);
                                  }
                                }
                              }}
                              disabled={data.status === 'paid' || total === 0}
                              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 w-full sm:w-auto ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CircleDollarSign size={16} /> Lançar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 p-6 shrink-0 flex flex-col sm:flex-row justify-end items-center gap-4 sm:gap-6">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Total Geral a Pagar
              </span>
              <span className="text-2xl font-black text-slate-800">
                {formatCurrency(
                  activeEmployees.reduce((acc, emp) => {
                    const data = closingData[emp.id];
                    if (data && data.status === 'pending') {
                       return acc + (data.daysWorked * data.dailyRate);
                    }
                    return acc;
                  }, 0)
                )}
              </span>
            </div>
          </div>
        )}

      </div>

      {isModalOpen && (
        <EmployeeModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEmployee}
          employeeToEdit={employeeToEdit}
          roles={roles}
          setRoles={setRoles}
        />
      )}

      {isCalendarModalOpen && employeeForCalendar && (
        <CalendarModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          employee={employeeForCalendar}
          workedDates={workedDates}
          setWorkedDates={setWorkedDates}
          setClosingData={setClosingData}
          currentDate={currentDate}
        />
      )}
    </div>
  );
}
