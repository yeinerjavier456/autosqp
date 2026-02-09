# Usamos una imagen ligera de Python
FROM python:3.10-slim

# Establecemos el directorio de trabajo
WORKDIR /app

# Instalamos dependencias del sistema si son necesarias (opcional pero recomendado para evitar errores con algunas librerías)
# RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copiamos el archivo de requerimientos
COPY requirements.txt .

# Instalamos las dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos el resto del código de la aplicación
COPY . .

# Exponemos el puerto en el que corre la aplicación
EXPOSE 8000

# Comando para correr la aplicación
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
