// Tipo para los datos de sensores ambientales
export interface EnvironmentData {
  id?: string;
  created_at?: string;
  temperature: number;
  humidity: number;
}

// Tipo para los datos del sistema hidropónico
export interface HydroData {
  id?: string;
  created_at?: string;
  water_temperature: number;
  ph: number;
  tds: number;
  ec?: number;
  water_level_ok: boolean;
}

// Tipo para el estado de los relés
export interface RelayState {
  id: number;
  name: string;
  state: boolean;
  timer?: number;
}

// Tipo para la configuración de nutrientes
export interface NutrientConfig {
  name: string;
  mlPerLiter: number;
  relayNumber: number;
}

// Tipo para la respuesta de datos del dashboard
export interface DashboardData {
  environment: EnvironmentData;
  hydro: HydroData;
  relays: RelayState[];
} 