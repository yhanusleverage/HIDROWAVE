'use client';

import React, { useState } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  BeakerIcon,
  WrenchIcon,
  SunIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

export interface CropTask {
  id: string;
  date: Date;
  type: 'dosagem' | 'manutencao' | 'monitoramento' | 'colheita' | 'plantio';
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  nutrients?: string[];
  duration?: number; // em minutos
}

export interface DayNote {
  date: Date;
  notes: string;
}

interface CropCalendarProps {
  tasks?: CropTask[];
  onTaskAdd?: (task: CropTask) => void;
  onTaskComplete?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
}

export default function CropCalendar({ 
  tasks = [], 
  onTaskAdd, 
  onTaskComplete, 
  onTaskDelete 
}: CropCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dayNotes, setDayNotes] = useState<Map<string, string>>(new Map());
  const [dayNote, setDayNote] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<CropTask['type']>('dosagem');
  const [newTaskPriority, setNewTaskPriority] = useState<CropTask['priority']>('medium');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(30);
  const [selectedNutrients, setSelectedNutrients] = useState<string[]>([]);

  // Navegação de datas
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Obter dias do mês/semana
  const getDaysInView = () => {
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      const day = start.getDay();
      const diff = start.getDate() - day;
      start.setDate(diff);
      
      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        days.push(date);
      }
      return days;
    } else {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();
      
      const days = [];
      // Dias do mês anterior
      const prevMonth = new Date(year, month, 0);
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        days.push(new Date(year, month - 1, prevMonth.getDate() - i));
      }
      // Dias do mês atual
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
      }
      // Dias do próximo mês para completar a grade
      const remainingDays = 42 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        days.push(new Date(year, month + 1, i));
      }
      return days;
    }
  };

  // Obter tarefas de uma data
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      const taskDate = new Date(task.date);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Verificar se é hoje
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Verificar se é do mês atual
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Abrir modal do dia
  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    const dateKey = day.toISOString().split('T')[0];
    setDayNote(dayNotes.get(dateKey) || '');
    setShowAddModal(true);
  };

  // Salvar anotação do dia
  const handleSaveNote = () => {
    if (selectedDate) {
      const dateKey = selectedDate.toISOString().split('T')[0];
      const newNotes = new Map(dayNotes);
      newNotes.set(dateKey, dayNote);
      setDayNotes(newNotes);
    }
  };

  // Adicionar nova tarefa
  const handleAddTask = () => {
    if (!selectedDate || !newTaskTitle.trim()) return;

    const newTask: CropTask = {
      id: Date.now().toString(),
      date: new Date(selectedDate),
      type: newTaskType,
      title: newTaskTitle,
      description: newTaskDescription || undefined,
      completed: false,
      priority: newTaskPriority,
      nutrients: selectedNutrients.length > 0 ? selectedNutrients : undefined,
      duration: newTaskDuration,
    };

    if (onTaskAdd) {
      onTaskAdd(newTask);
    }

    // Limpar formulário
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskType('dosagem');
    setNewTaskPriority('medium');
    setNewTaskDuration(30);
    setSelectedNutrients([]);
  };

  // Obter anotação do dia
  const getDayNote = (date: Date): string => {
    const dateKey = date.toISOString().split('T')[0];
    return dayNotes.get(dateKey) || '';
  };

  // Toggle nutriente
  const toggleNutrient = (nutrient: string) => {
    setSelectedNutrients(prev => 
      prev.includes(nutrient)
        ? prev.filter(n => n !== nutrient)
        : [...prev, nutrient]
    );
  };

  const availableNutrients = ['Grow', 'Micro', 'Bloom', 'CalMag', 'pH-', 'pH+'];

  // Obter ícone do tipo de tarefa
  const getTaskIcon = (type: CropTask['type']) => {
    switch (type) {
      case 'dosagem':
        return <BeakerIcon className="h-4 w-4" />;
      case 'manutencao':
        return <WrenchIcon className="h-4 w-4" />;
      case 'monitoramento':
        return <SunIcon className="h-4 w-4" />;
      case 'colheita':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'plantio':
        return <PlusIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  // Obter cor do tipo de tarefa
  const getTaskColor = (type: CropTask['type']) => {
    switch (type) {
      case 'dosagem':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'manutencao':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'monitoramento':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'colheita':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'plantio':
        return 'bg-aqua-500/20 text-aqua-400 border-aqua-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Obter cor da prioridade
  const getPriorityColor = (priority: CropTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const days = getDaysInView();
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden">
      {/* Header do Calendário - Colapsável */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 cursor-pointer hover:bg-dark-surface/50 transition-all"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-dark-text flex items-center gap-2">
              <span className="text-2xl">📅</span>
              Calendário de Cultivo
            </h2>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className="p-2 hover:bg-dark-border rounded-lg transition-all sm:hidden"
          >
            {isCollapsed ? (
              <ChevronDownIcon className="h-5 w-5 text-dark-text" />
            ) : (
              <ChevronUpIcon className="h-5 w-5 text-dark-text" />
            )}
          </button>
        </div>
        
        {!isCollapsed && (
          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* Toggle Semana/Mês */}
            <div className="flex bg-dark-surface border border-dark-border rounded-lg p-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('week');
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                  viewMode === 'week'
                    ? 'bg-aqua-500 text-white'
                    : 'text-dark-textSecondary hover:text-dark-text'
                }`}
              >
                Semana
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('month');
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                  viewMode === 'month'
                    ? 'bg-aqua-500 text-white'
                    : 'text-dark-textSecondary hover:text-dark-text'
                }`}
              >
                Mês
              </button>
            </div>
            
            {/* Navegação */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="p-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-dark-text transition-all"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToToday();
                }}
                className="px-4 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50 text-sm font-medium"
              >
                Hoje
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="p-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-dark-text transition-all"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Botão Adicionar Tarefa */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const today = new Date();
                handleDayClick(today);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all shadow-lg hover:shadow-green-500/50 text-sm font-medium"
            >
              <PlusIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Nova Tarefa</span>
            </button>
          </div>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          className="hidden sm:block p-2 hover:bg-dark-border rounded-lg transition-all"
        >
          {isCollapsed ? (
            <ChevronDownIcon className="h-5 w-5 text-dark-text" />
          ) : (
            <ChevronUpIcon className="h-5 w-5 text-dark-text" />
          )}
        </button>
      </div>

      {/* Conteúdo do Calendário - Colapsável */}
      {!isCollapsed && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
      {/* Título do Mês/Período */}
      <div className="mb-4">
        <h3 className="text-lg sm:text-xl font-semibold text-dark-text">
          {viewMode === 'month' 
            ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            : `Semana de ${days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
          }
        </h3>
      </div>

      {/* Calendário */}
      <div className="overflow-x-auto">
        {viewMode === 'month' ? (
          <div className="min-w-full">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className="p-2 text-center text-sm font-semibold text-dark-textSecondary"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Dias do calendário */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const dayTasks = getTasksForDate(day);
                const isCurrentMonthDay = isCurrentMonth(day);
                const isTodayDay = isToday(day);
                
                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[100px] sm:min-h-[120px] p-2 border border-dark-border rounded-lg transition-all cursor-pointer hover:border-aqua-500/50 ${
                      !isCurrentMonthDay ? 'opacity-40' : ''
                    } ${
                      isTodayDay 
                        ? 'bg-aqua-500/10 border-aqua-500/50' 
                        : 'bg-dark-surface'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isTodayDay ? 'text-aqua-400' : 'text-dark-text'
                    }`}>
                      {day.getDate()}
                    </div>
                    
                    <div className="space-y-1">
                      {dayTasks.slice(0, 2).map((task) => (
                        <div
                          key={task.id}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-xs px-1.5 py-0.5 rounded border flex items-center gap-1 ${getTaskColor(task.type)} ${
                            task.completed ? 'opacity-60 line-through' : ''
                          }`}
                        >
                          {getTaskIcon(task.type)}
                          <span className="truncate">{task.title}</span>
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-xs text-dark-textSecondary px-1.5">
                          +{dayTasks.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="min-w-full">
            {/* Vista Semanal */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const dayTasks = getTasksForDate(day);
                const isTodayDay = isToday(day);
                
                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[200px] p-3 border border-dark-border rounded-lg cursor-pointer hover:border-aqua-500/50 transition-all ${
                      isTodayDay 
                        ? 'bg-aqua-500/10 border-aqua-500/50' 
                        : 'bg-dark-surface'
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-2 ${
                      isTodayDay ? 'text-aqua-400' : 'text-dark-text'
                    }`}>
                      {weekDays[day.getDay()]}
                    </div>
                    <div className={`text-xs mb-3 ${
                      isTodayDay ? 'text-aqua-300' : 'text-dark-textSecondary'
                    }`}>
                      {day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </div>
                    
                    <div className="space-y-2">
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`p-2 rounded-lg border text-xs ${getTaskColor(task.type)} ${
                            task.completed ? 'opacity-60 line-through' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              {getTaskIcon(task.type)}
                              <span className="font-medium">{task.title}</span>
                            </div>
                            {task.completed && (
                              <CheckCircleIcon className="h-4 w-4 text-green-400" />
                            )}
                          </div>
                          {task.description && (
                            <div className="text-xs opacity-75 mt-1">
                              {task.description}
                            </div>
                          )}
                          {task.nutrients && task.nutrients.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {task.nutrients.map((nutrient, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-dark-bg/50 rounded text-xs"
                                >
                                  {nutrient}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs border ${getPriorityColor(task.priority)}`}>
                              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                            </span>
                            {task.duration && (
                              <span className="text-xs opacity-75">
                                {task.duration}min
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-2">
                            {!task.completed && onTaskComplete && (
                              <button
                                onClick={() => onTaskComplete(task.id)}
                                className="flex-1 px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs transition-all"
                              >
                                Concluir
                              </button>
                            )}
                            {onTaskDelete && (
                              <button
                                onClick={() => onTaskDelete(task.id)}
                                className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-all"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {dayTasks.length === 0 && (
                        <div className="text-xs text-dark-textSecondary text-center py-4">
                          Sem tarefas
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="mt-6 pt-4 border-t border-dark-border">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-dark-textSecondary font-medium">Legenda:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30"></div>
            <span className="text-dark-textSecondary">Dosagem</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30"></div>
            <span className="text-dark-textSecondary">Manutenção</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></div>
            <span className="text-dark-textSecondary">Monitoramento</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30"></div>
            <span className="text-dark-textSecondary">Colheita</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-aqua-500/20 border border-aqua-500/30"></div>
            <span className="text-dark-textSecondary">Plantio</span>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* Modal de Dia - Anotações e Tarefas */}
      {showAddModal && selectedDate && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            handleSaveNote();
            setShowAddModal(false);
          }}
        >
          <div 
            className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="sticky top-0 bg-dark-card border-b border-dark-border p-4 sm:p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-dark-text">
                  {selectedDate.toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </h3>
                <p className="text-sm text-dark-textSecondary mt-1">
                  Gerencie tarefas e anotações para este dia
                </p>
              </div>
              <button
                onClick={() => {
                  handleSaveNote();
                  setShowAddModal(false);
                }}
                className="p-2 hover:bg-dark-border rounded-lg transition-all"
              >
                <XMarkIcon className="h-6 w-6 text-dark-text" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Anotações do Dia */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2 flex items-center gap-2">
                  <PencilIcon className="h-5 w-5" />
                  Anotações do Dia
                </label>
                <textarea
                  value={dayNote}
                  onChange={(e) => setDayNote(e.target.value)}
                  onBlur={handleSaveNote}
                  placeholder="Adicione anotações, observações ou lembretes para este dia..."
                  className="w-full p-3 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none min-h-[100px] resize-y"
                />
                {dayNote && (
                  <p className="text-xs text-dark-textSecondary mt-1">
                    Anotação salva automaticamente
                  </p>
                )}
              </div>

              {/* Tarefas do Dia */}
              <div>
                <h4 className="text-lg font-semibold text-dark-text mb-4 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5" />
                  Tarefas do Dia
                </h4>
                
                {/* Lista de Tarefas Existentes */}
                <div className="space-y-2 mb-4">
                  {getTasksForDate(selectedDate).map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border ${getTaskColor(task.type)} ${
                        task.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getTaskIcon(task.type)}
                            <span className={`font-medium text-sm ${task.completed ? 'line-through' : ''}`}>
                              {task.title}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs opacity-75 mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(task.priority)}`}>
                              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                            </span>
                            {task.duration && (
                              <span className="text-xs opacity-75">{task.duration}min</span>
                            )}
                            {task.nutrients && task.nutrients.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {task.nutrients.map((nutrient, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-dark-bg/50 rounded text-xs">
                                    {nutrient}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!task.completed && onTaskComplete && (
                            <button
                              onClick={() => onTaskComplete(task.id)}
                              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-all"
                              title="Concluir"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                            </button>
                          )}
                          {onTaskDelete && (
                            <button
                              onClick={() => onTaskDelete(task.id)}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all"
                              title="Remover"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {getTasksForDate(selectedDate).length === 0 && (
                    <p className="text-sm text-dark-textSecondary text-center py-4">
                      Nenhuma tarefa para este dia
                    </p>
                  )}
                </div>

                {/* Formulário Nova Tarefa */}
                <div className="border-t border-dark-border pt-4">
                  <h5 className="text-md font-semibold text-dark-text mb-4">Adicionar Nova Tarefa</h5>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                        Título da Tarefa *
                      </label>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Ex: Dosagem Semanal - Grow + Micro"
                        className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                          Tipo
                        </label>
                        <select
                          value={newTaskType}
                          onChange={(e) => setNewTaskType(e.target.value as CropTask['type'])}
                          className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          <option value="dosagem">Dosagem</option>
                          <option value="manutencao">Manutenção</option>
                          <option value="monitoramento">Monitoramento</option>
                          <option value="colheita">Colheita</option>
                          <option value="plantio">Plantio</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                          Prioridade
                        </label>
                        <select
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value as CropTask['priority'])}
                          className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                        >
                          <option value="low">Baixa</option>
                          <option value="medium">Média</option>
                          <option value="high">Alta</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                        Descrição
                      </label>
                      <textarea
                        value={newTaskDescription}
                        onChange={(e) => setNewTaskDescription(e.target.value)}
                        placeholder="Descrição detalhada da tarefa..."
                        className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none min-h-[80px] resize-y"
                      />
                    </div>

                    {newTaskType === 'dosagem' && (
                      <div>
                        <label className="block text-sm font-medium text-dark-textSecondary mb-2">
                          Nutrientes
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {availableNutrients.map((nutrient) => (
                            <button
                              key={nutrient}
                              type="button"
                              onClick={() => toggleNutrient(nutrient)}
                              className={`px-3 py-1.5 rounded-lg border transition-all text-sm ${
                                selectedNutrients.includes(nutrient)
                                  ? 'bg-aqua-500/20 border-aqua-500 text-aqua-400'
                                  : 'bg-dark-surface border-dark-border text-dark-textSecondary hover:border-aqua-500/50'
                              }`}
                            >
                              {nutrient}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-dark-textSecondary mb-1">
                        Duração (minutos)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newTaskDuration}
                        onChange={(e) => setNewTaskDuration(parseInt(e.target.value) || 0)}
                        className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg hover:shadow-green-500/50 font-medium flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Adicionar Tarefa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
