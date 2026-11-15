# Lunar Site Explorer

**Lunar Landing Site Navigator** es una aplicación educativa para explorar posibles sitios de aterrizaje en el polo sur lunar. Reúne información topográfica y astronómica en una interfaz visual para ayudar a comparar escenarios por ubicación y fecha.

El proyecto fue desarrollado por el Semillero de Astronomía del María 1 para acercar la exploración lunar a estudiantes, docentes y personas interesadas en astronomía, ciencias e ingeniería. Sus resultados son de carácter preliminar y educativo; no constituyen una recomendación certificada para una misión.

## Funcionalidades

- Explorar el relieve lunar y consultar elevaciones y parches de terreno.
- Consultar las posiciones aparentes del Sol y la Tierra para un sitio y periodo.
- Comparar información mediante vistas 2D, 3D y paneles de análisis.
- Consultar la investigación completa en [PDF](frontend/public/docs/investigacion.pdf).
- Revisar las [fuentes de datos y referencias](https://github.com/Joselyn0227/LUNAR-SITE-EXPLORER/tree/main/frontend/src/pages/Sources).

## Arquitectura y fuentes

- **Frontend:** React, TypeScript y Vite. La interfaz incluye mapas, visualizaciones y una escena lunar 3D.
- **Backend:** Python y FastAPI. Expone endpoints para terreno, elevación y datos astronómicos.
- **Datos astronómicos:** NASA/JPL Horizons, consultado por el backend para obtener posiciones del Sol y la Tierra.
- **Topografía:** modelos digitales de elevación LOLA de la misión Lunar Reconnaissance Orbiter.

Endpoints principales del backend:

| Método | Ruta | Función |
| --- | --- | --- |
| `GET` | `/luna/terreno` | Devuelve un parche de elevación lunar. |
| `GET` | `/luna/elevacion` | Consulta la elevación de un punto. |
| `GET` | `/luna/cielo` | Devuelve datos del Sol y la Tierra para un periodo. |

## Ejecutar en local

Se necesitan Node.js con npm y Python 3.10 o posterior. El backend y el frontend se ejecutan en terminales separadas.

### 1. Iniciar el backend

Desde la raíz del repositorio:

```powershell
cd backend
python -m venv .venv
```

Activa el entorno virtual:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS o Linux
source .venv/bin/activate
```

Instala las dependencias e inicia FastAPI:

```powershell
pip install -r requirements.txt
pip install numpy rasterio
uvicorn app.main:app --reload
```

La API queda disponible en `http://127.0.0.1:8000`; su documentación interactiva está en `http://127.0.0.1:8000/docs`.

### 2. Iniciar el frontend

En otra terminal, desde la raíz del repositorio:

```powershell
cd frontend
npm ci
npm run dev
```

Abre la dirección que indique Vite, normalmente `http://localhost:5173`. Durante el desarrollo, Vite reenvía las solicitudes `/api` al backend local.

## Comandos del frontend

Desde `frontend/`:

```bash
npm run build
npm run lint
```

## Recursos del sitio

- El documento de investigación se encuentra en `frontend/public/docs/investigacion.pdf`.
- Los retratos del equipo se guardan en `frontend/public/images/`.
- Cuando esté listo el video pitch, guárdalo como `frontend/public/video-pitch.mp4`.

## Despliegue

GitHub Pages puede alojar el frontend estático, pero no ejecuta el backend FastAPI. Para que la demo consulte datos en producción, el backend debe desplegarse por separado y el frontend debe configurarse con la URL pública de esa API. También se debe configurar la ruta base del proyecto para GitHub Pages.

## Referencias

La página de [Fuentes de datos](https://github.com/Joselyn0227/LUNAR-SITE-EXPLORER/tree/main/frontend/src/pages/Sources) reúne las referencias utilizadas, entre ellas:

- [Lunar South Pole Atlas — LPI/USRA](https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/)
- [LOLA — NASA Science](https://science.nasa.gov/mission/lro/lola/)
- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
- [NASA Scientific Visualization Studio: CGI Moon Kit](https://svs.gsfc.nasa.gov/4720)
