# Seguimiento de Trámites - Backend

API del sistema de **Seguimiento de Trámites** del **Gobierno Autónomo Municipal de Sacaba (GAMS)**.

## Descripción

Este sistema permite gestionar y dar seguimiento a trámites internos y externos dentro de la institución, incluyendo flujo de procesos, participantes, historial de envíos y estado del trámite.

## Funcionalidades principales

- Gestión de trámites
- Flujo de procesos
- Historial de envíos y seguimiento
- Gestión de participantes
- Publicación de noticias

## Requisitos previos

Antes de iniciar, asegúrate de tener instalado:

- Node.js
- npm
- MongoDB

## Instalación

```bash
npm install
```

## Configuración

Renombra el archivo `.env.template` a `.env` en la raíz del proyecto y configura las variables de entorno necesarias.

## Ejecución del proyecto

### Modo desarrollo

```bash
npm run start:dev
```

### Modo producción

```bash
npm run build
npm run start:prod
```
