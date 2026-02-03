# Etapa 1: Construcción
FROM node:18-alpine as build

WORKDIR /app

# Copiamos los archivos de dependencias
COPY package.json package-lock.json ./

# Instalamos dependencias
RUN npm ci

# Copiamos el código fuente
COPY . .

# Construimos la aplicación para producción
RUN npm run build

# Etapa 2: Servidor Web
FROM nginx:alpine

# Copiamos los archivos construidos desde la etapa anterior al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiamos una configuración básica de Nginx si es necesaria para manejar el enrutamiento de React (SPA)
# (Por ahora usamos la configuración por defecto, pero crearemos un pequeño script para asegurar que el enrutamiento funcione)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
