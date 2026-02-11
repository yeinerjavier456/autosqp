# AutosQP - Sistema de Gestión para Concesionarios

AutosQP es una plataforma integral SaaS para la gestión de concesionarios de vehículos. Permite administrar inventarios, gestión de leads (Facebook, TikTok, WhatsApp, etc.), roles de usuarios y configuración multi-empresa.

## 🚀 Características Principales

*   **Gestión de Inventario**: CRUD completo de vehículos con carga de fotos y selección inteligente de Marcas/Modelos.
*   **Gestión de Leads**: Centralización de prospectos desde múltiples fuentes.
*   **Multi-Tenancy**: Soporte para múltiples empresas con configuraciones independientes.
*   **Roles y Permisos**: Sistema robusto con roles de Super Admin, Admin de Empresa, Asesor y Usuario.
*   **Analítica**: Dashboard con gráficas y estadísticas de rendimiento.
*   **Diseño Moderno**: Interfaz React con TailwindCSS.

## 🛠️ Tecnologías

### Backend
*   **Python 3.10+**
*   **FastAPI**: Framework web de alto rendimiento.
*   **SQLAlchemy**: ORM para base de datos.
*   **Alembic**: Migraciones de base de datos.
*   **Pydantic**: Validación de datos.

### Frontend
*   **React + Vite**: Desarrollo frontend rápido.
*   **TailwindCSS**: Estilizado utility-first.
*   **Axios**: Cliente HTTP.
*   **Chart.js**: Visualización de datos.

## ⚙️ Instalación y Configuración

### Prerrequisitos
*   Node.js (v18+)
*   Python (v3.10+)
*   Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/yeinerjavier456/autosqp.git
cd autosqp
```

### 2. Configurar Backend
```bash
cd backend
# Crear entorno virtual
python -m venv venv

# Activar entorno (Windows)
.\venv\Scripts\activate
# Activar entorno (Mac/Linux)
# source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
python -m uvicorn main:app --reload --port 8000
```

### 3. Configurar Frontend
```bash
cd frontend
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible generalmente en `http://localhost:5173`.

## 🚀 Despliegue (Deployment)

Para poner en producción la aplicación por separado:

### Backend (Python)
1. Asegúrate de tener las variables de entorno configuradas en tu servidor (ver `.env`).
2. Instala las dependencias: `pip install -r requirements.txt` (ahora incluye `gunicorn`).
3. Ejecuta con un servidor de producción como Gunicorn (Linux) o Uvicorn:
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
   # O en Windows/Dev:
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
4. **Nota Importante**: Si despliegas en un dominio real (ej. `mi-api.com`), actualiza `backend/main.py` para permitir el origen del frontend en `CORSMiddleware`.

### Frontend (React)
1. **Configuración de API**: El frontend actualmente apunta a `http://localhost:8000`. 
   - Antes de construir para producción, busca y reemplaza `http://localhost:8000` por la URL de tu backend en producción en la carpeta `src`.
2. Construye la aplicación:
   ```bash
   npm run build
   ```
3. Sube el contenido de la carpeta `dist/` a tu proveedor de hosting estático (Netlify, Vercel, S3, etc.).

## 📦 Estructura del Proyecto

```
autosqp/
├── backend/            # API FastAPI
│   ├── main.py         # Punto de entrada
│   ├── models.py       # Modelos DB
│   ├── schemas.py      # Schemas Pydantic
│   └── ...
├── frontend/           # App React
│   ├── src/
│   │   ├── components/ # Componentes reutilizables
│   │   ├── pages/      # Vistas principales
│   │   └── context/    # Estado global (Auth)
│   └── ...
└── README.md           # Documentación
```

## 🤝 Contribución
Las contribuciones son bienvenidas. Por favor, abre un issue o envía un pull request.
