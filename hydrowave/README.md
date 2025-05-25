# HydroWave - Sistema de Control Hidropónico

Sistema de control hidropónico con ESP32 y Next.js, usando Supabase como base de datos para almacenar las mediciones de sensores y controlar actuadores.

## Características

- 🌡️ Monitoreo de temperatura y humedad del ambiente
- 💧 Monitoreo de temperatura, pH, TDS/EC del agua
- ⚙️ Control de relés para bombas, luces y aireadores
- 📊 Gráficos de datos históricos
- 🧪 Sistema de dosificación de nutrientes
- 📱 Interfaz web responsive adaptada a móviles y escritorio

## Tecnologías utilizadas

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Chart.js
- **Backend**: API Routes de Next.js, Supabase (PostgreSQL)
- **Hardware**: ESP32, sensores (DHT22, pH, TDS), relés

## Estructura del proyecto

```
hydrowave/
├── src/
│   ├── app/               # Páginas y rutas de la aplicación
│   │   ├── api/           # API endpoints
│   │   │   ├── data/      # API para obtener datos de sensores
│   │   │   └── relay/     # API para controlar relés
│   ├── components/        # Componentes React
│   ├── lib/               # Utilidades y configuraciones
│   └── types/             # Definiciones de tipos TypeScript
├── scripts/               # Scripts de utilidad
└── public/                # Archivos estáticos
```

## Configuración

### Requisitos previos

- Node.js 18 o superior
- Cuenta en Supabase (https://supabase.com)
- ESP32 con el firmware adecuado (ver carpeta `firmware/`)

### Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-key
ESP32_IP=192.168.1.100  # IP de tu ESP32 en la red local
```

### Inicialización de la base de datos

Para inicializar las tablas en Supabase:

```bash
# Instalar ts-node si no lo tienes
npm install -g ts-node

# Ejecutar el script de inicialización
SUPABASE_URL=https://tu-proyecto.supabase.co SUPABASE_KEY=tu-service-role-key npx ts-node scripts/init-db.ts
```

## Ejecución del proyecto

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev

# Construir para producción
npm run build

# Iniciar en modo producción
npm start
```

## Configuración del ESP32

1. Cargar el firmware del ESP32 ubicado en la carpeta `firmware/`
2. Configurar el ESP32 con las credenciales de WiFi y Supabase
3. Asegurarse de que el ESP32 y el servidor web estén en la misma red local

## Licencia

Este proyecto está licenciado bajo la licencia MIT.

## Colaboradores

- [Tu Nombre]

---

Desarrollado con ❤️ para sistemas hidropónicos automatizados.
