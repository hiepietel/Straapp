# Straapp web app. Build from the ui/ folder:  docker build -t straapp-ui ui

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- serve ----
# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine

# The official image renders /etc/nginx/templates/*.template with the environment on start.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html

# Where /api goes: the API's service name in Docker Compose; Kubernetes overrides it.
ENV API_UPSTREAM=http://api:8080
EXPOSE 8080
