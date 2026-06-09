/**
 * Biblioteca para gerenciar calendário de cultivo via Supabase
 * 
 * Todas as funções trabalham com as tabelas crop_* no Supabase
 */

import { CropTask, DayNote } from '@/components/CropCalendar';

export interface CropAlarm {
  id: string;
  device_id: string;
  user_email: string;
  title: string;
  description?: string;
  alarm_type: 'reminder' | 'alert' | 'notification';
  alarm_date: string;
  alarm_time: string;
  enabled: boolean;
  repeat_pattern?: string;
  days_before: number;
  triggered: boolean;
  triggered_at?: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CropEvent {
  id: string;
  device_id: string;
  user_email: string;
  title: string;
  description?: string;
  event_type: 'dosagem' | 'manutencao' | 'monitoramento' | 'colheita' | 'plantio' | 'fertilizacao' | 'poda' | 'transplante';
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_interval: number;
  recurrence_end_date?: string;
  automated_actions?: unknown[];
  enabled: boolean;
  completed: boolean;
  completed_at?: string;
  last_synced_at?: string;
  sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
  updated_at: string;
}

// ✅ Tipos válidos para tareas
export type TaskType = 'dosagem' | 'manutencao' | 'monitoramento' | 'colheita' | 'plantio';
export type TaskPriority = 'low' | 'medium' | 'high';

// ✅ Función para validar el tipo de tarea
function validateTaskType(value: string): TaskType {
  const validTypes: readonly TaskType[] = ['dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio'];
  if (validTypes.includes(value as TaskType)) {
    return value as TaskType;
  }
  // Si no es válido, usar 'monitoramento' como valor por defecto seguro
  return 'monitoramento';
}

// ✅ Función para convertir número de prioridad a string
function validateTaskPriority(value: number | undefined): TaskPriority {
  // Si no hay valor, usar 'medium' por defecto
  if (value === undefined || value === null) {
    return 'medium';
  }
  // Convertir número a prioridad: 1-3 = low, 4-7 = medium, 8-10 = high
  if (value <= 3) return 'low';
  if (value <= 7) return 'medium';
  return 'high';
}

interface TaskFromAPI {
  id: string;
  task_date: string;
  task_type: string; // Viene de la API como string genérico
  title: string;
  description?: string;
  completed: boolean;
  priority?: number; // Viene de la API como número
}

interface NoteFromAPI {
  note_date: string;
  notes?: string;
}

// ✅ EventFromAPI: todos los campos de CropEvent que vienen de la API
interface EventFromAPI {
  id: string;
  device_id: string;
  user_email: string;
  title: string;
  description?: string;
  event_type: string; // Viene como string genérico
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_interval: number;
  recurrence_end_date?: string;
  automated_actions?: string | unknown[]; // Puede venir como string JSON o array
  enabled: boolean;
  completed: boolean;
  completed_at?: string;
  last_synced_at?: string;
  sync_status: string; // Viene como string genérico
  created_at: string;
  updated_at: string;
}

// =====================================================
// TAREFAS (crop_tasks)
// =====================================================

export async function getCropTasks(
  deviceId: string,
  userEmail: string,
  options?: {
    startDate?: string;
    endDate?: string;
    completed?: boolean;
  }
): Promise<CropTask[]> {
  try {
    const params = new URLSearchParams({
      device_id: deviceId,
      user_email: userEmail,
    });

    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);
    if (options?.completed !== undefined) params.append('completed', String(options.completed));

    const response = await fetch(`/api/crop/tasks?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Erro ao buscar tarefas: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.tasks as TaskFromAPI[]).map((task: TaskFromAPI) => ({
      id: task.id,
      date: new Date(task.task_date),
      type: validateTaskType(task.task_type), // ✅ Validar que sea un tipo válido
      title: task.title,
      description: task.description,
      completed: task.completed,
      priority: validateTaskPriority(task.priority), // ✅ Convertir número a 'low'|'medium'|'high'
    }));
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error);
    return [];
  }
}

export async function createCropTask(
  deviceId: string,
  userEmail: string,
  task: Omit<CropTask, 'id'>
): Promise<CropTask | null> {
  try {
    const response = await fetch('/api/crop/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        user_email: userEmail,
        title: task.title,
        description: task.description,
        task_type: task.type,
        priority: task.priority,
        task_date: task.date.toISOString().split('T')[0],
        task_time: task.date.toTimeString().split(' ')[0].slice(0, 5),
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar tarefa: ${response.statusText}`);
    }

    const data = await response.json();
    const createdTask = data.task;
    return {
      id: createdTask.id,
      date: new Date(createdTask.task_date),
      type: createdTask.task_type,
      title: createdTask.title,
      description: createdTask.description,
      completed: createdTask.completed,
      priority: createdTask.priority,
    };
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    return null;
  }
}

export async function updateCropTask(
  taskId: string,
  updates: Partial<CropTask>
): Promise<CropTask | null> {
  try {
    const body: Record<string, unknown> = { id: taskId };
    
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.type !== undefined) body.task_type = updates.type;
    if (updates.priority !== undefined) body.priority = updates.priority;
    if (updates.completed !== undefined) body.completed = updates.completed;
    if (updates.date !== undefined) {
      body.task_date = updates.date.toISOString().split('T')[0];
      body.task_time = updates.date.toTimeString().split(' ')[0].slice(0, 5);
    }

    const response = await fetch('/api/crop/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar tarefa: ${response.statusText}`);
    }

    const data = await response.json();
    const updatedTask = data.task;
    return {
      id: updatedTask.id,
      date: new Date(updatedTask.task_date),
      type: updatedTask.task_type,
      title: updatedTask.title,
      description: updatedTask.description,
      completed: updatedTask.completed,
      priority: updatedTask.priority,
    };
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    return null;
  }
}

export async function deleteCropTask(taskId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/crop/tasks?id=${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar tarefa: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Erro ao deletar tarefa:', error);
    return false;
  }
}

// =====================================================
// ANOTAÇÕES DIÁRIAS (crop_day_notes)
// =====================================================

export async function getCropDayNotes(
  deviceId: string,
  userEmail: string,
  options?: {
    startDate?: string;
    endDate?: string;
    noteDate?: string;
  }
): Promise<DayNote[]> {
  try {
    const params = new URLSearchParams({
      device_id: deviceId,
      user_email: userEmail,
    });

    if (options?.noteDate) {
      params.append('note_date', options.noteDate);
    } else {
      if (options?.startDate) params.append('start_date', options.startDate);
      if (options?.endDate) params.append('end_date', options.endDate);
    }

    const response = await fetch(`/api/crop/notes?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Erro ao buscar anotações: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.notes as NoteFromAPI[]).map((note: NoteFromAPI) => ({
      date: new Date(note.note_date),
      notes: note.notes || '',
    }));
  } catch (error) {
    console.error('Erro ao buscar anotações:', error);
    return [];
  }
}

export async function saveCropDayNote(
  deviceId: string,
  userEmail: string,
  note: DayNote
): Promise<DayNote | null> {
  try {
    const response = await fetch('/api/crop/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        user_email: userEmail,
        note_date: note.date.toISOString().split('T')[0],
        notes: note.notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao salvar anotação: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      date: new Date(data.note.note_date),
      notes: data.note.notes || '',
    };
  } catch (error) {
    console.error('Erro ao salvar anotação:', error);
    return null;
  }
}

export async function deleteCropDayNote(
  deviceId: string,
  userEmail: string,
  noteDate: Date
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      device_id: deviceId,
      user_email: userEmail,
      note_date: noteDate.toISOString().split('T')[0],
    });

    const response = await fetch(`/api/crop/notes?${params.toString()}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar anotação: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Erro ao deletar anotação:', error);
    return false;
  }
}

// =====================================================
// ALARMES (crop_alarms)
// =====================================================

export async function getCropAlarms(
  deviceId: string,
  userEmail: string,
  options?: {
    enabled?: boolean;
    triggered?: boolean;
    upcoming?: number; // Próximos X dias
  }
): Promise<CropAlarm[]> {
  try {
    const params = new URLSearchParams({
      device_id: deviceId,
      user_email: userEmail,
    });

    if (options?.enabled !== undefined) params.append('enabled', String(options.enabled));
    if (options?.triggered !== undefined) params.append('triggered', String(options.triggered));
    if (options?.upcoming) params.append('upcoming', String(options.upcoming));

    const response = await fetch(`/api/crop/alarms?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Erro ao buscar alarmes: ${response.statusText}`);
    }

    const data = await response.json();
    return data.alarms;
  } catch {
    console.error('Erro ao buscar alarmes');
    return [];
  }
}

export async function createCropAlarm(
  deviceId: string,
  userEmail: string,
  alarm: Omit<CropAlarm, 'id' | 'device_id' | 'user_email' | 'created_at' | 'updated_at' | 'triggered' | 'acknowledged'>
): Promise<CropAlarm | null> {
  try {
    const response = await fetch('/api/crop/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        user_email: userEmail,
        ...alarm,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar alarme: ${response.statusText}`);
    }

    const data = await response.json();
    return data.alarm;
  } catch {
    console.error('Erro ao criar alarme');
    return null;
  }
}

export async function acknowledgeCropAlarm(alarmId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/crop/alarms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: alarmId,
        acknowledged: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao reconhecer alarme: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Erro ao reconhecer alarme:', error);
    return false;
  }
}

// =====================================================
// EVENTOS (crop_events)
// =====================================================

export async function getCropEvents(
  deviceId: string,
  userEmail: string,
  options?: {
    startDate?: string;
    endDate?: string;
    enabled?: boolean;
    isRecurring?: boolean;
  }
): Promise<CropEvent[]> {
  try {
    const params = new URLSearchParams({
      device_id: deviceId,
      user_email: userEmail,
    });

    if (options?.startDate) params.append('start_date', options.startDate);
    if (options?.endDate) params.append('end_date', options.endDate);
    if (options?.enabled !== undefined) params.append('enabled', String(options.enabled));
    if (options?.isRecurring !== undefined) params.append('is_recurring', String(options.isRecurring));

    const response = await fetch(`/api/crop/events?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Erro ao buscar eventos: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.events as EventFromAPI[]).map((event: EventFromAPI): CropEvent => ({
      id: event.id,
      device_id: event.device_id,
      user_email: event.user_email,
      title: event.title,
      description: event.description,
      event_type: event.event_type as CropEvent['event_type'], // Type assertion segura
      start_date: event.start_date,
      start_time: event.start_time,
      end_date: event.end_date,
      end_time: event.end_time,
      is_recurring: event.is_recurring,
      recurrence_pattern: event.recurrence_pattern,
      recurrence_interval: event.recurrence_interval,
      recurrence_end_date: event.recurrence_end_date,
      automated_actions: typeof event.automated_actions === 'string' 
        ? JSON.parse(event.automated_actions) 
        : event.automated_actions || [],
      enabled: event.enabled,
      completed: event.completed,
      completed_at: event.completed_at,
      last_synced_at: event.last_synced_at,
      sync_status: event.sync_status as CropEvent['sync_status'], // Type assertion segura
      created_at: event.created_at,
      updated_at: event.updated_at,
    }));
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    return [];
  }
}

export async function createCropEvent(
  deviceId: string,
  userEmail: string,
  event: Omit<CropEvent, 'id' | 'device_id' | 'user_email' | 'created_at' | 'updated_at' | 'completed' | 'sync_status'>
): Promise<CropEvent | null> {
  try {
    const response = await fetch('/api/crop/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        user_email: userEmail,
        ...event,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar evento: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ...data.event,
      automated_actions: typeof data.event.automated_actions === 'string'
        ? JSON.parse(data.event.automated_actions)
        : data.event.automated_actions || [],
    };
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return null;
  }
}
