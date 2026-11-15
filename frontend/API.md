# Conectar la demo con la API lunar

La demo consulta `GET /luna/elevacion?lat=...&lon=...` para el sitio seleccionado.
El resto de la lista y sus indicadores siguen siendo datos locales de demostración.

## Iniciar localmente

En una terminal, inicia el backend:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

En otra terminal, inicia el frontend:

```powershell
cd frontend
npm install
npm run dev
```

El frontend usa `http://localhost:8000` por defecto. Para usar otra URL, define
`VITE_API_BASE_URL` antes de ejecutar `npm run dev`. La documentación interactiva
del backend está en `http://localhost:8000/docs`.
