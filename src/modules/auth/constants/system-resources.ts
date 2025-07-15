import { reportType } from 'src/modules/reports/enums/report-types.enum';

export enum SystemResource {
  INSTITUTIONS = 'institutions',
  DEPENDENCIES = 'dependencies',
  TYPES_PROCEDURES = 'types-procedures',
  OFFICERS = 'officers',
  ACCOUNTS = 'accounts',
  USERS = 'user',
  ROLES = 'roles',
  EXTERNAL = 'external',
  INTERNAL = 'internal',
  PROCUREMENT = 'procurement',
  REPORTS = 'reports',
  RESOURCES = 'resources',
  PUBLICATIONS = 'publications',
  groupware = 'groupware',
}

export const SYSTEM_RESOURCES = [
  {
    value: SystemResource.INSTITUTIONS,
    label: 'INSTITUCIONES',
    actions: [
      { value: 'read', label: 'Ver' },
      { value: 'create', label: 'Crear' },
      { value: 'update', label: 'Editar' },
    ],
  },
  {
    value: SystemResource.DEPENDENCIES,
    label: 'DEPENDENCIAS',
    actions: [
      { value: 'read', label: 'Ver' },
      { value: 'create', label: 'Crear' },
      { value: 'update', label: 'Editar' },
    ],
  },
  {
    value: SystemResource.TYPES_PROCEDURES,
    label: 'TIPOS DE TRAMITES',
    actions: [
      { value: 'read', label: 'Ver' },
      { value: 'create', label: 'Crear' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.OFFICERS,
    label: 'FUNCIONARIOS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },

  {
    value: SystemResource.ACCOUNTS,
    label: 'CUENTAS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.USERS,
    label: 'USUARIOS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.ROLES,
    label: 'ROLES',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },

  {
    value: SystemResource.groupware,
    label: 'GRUPO DE TRABAJO',
    actions: [{ value: 'manage', label: 'Administrar' }],
  },
  {
    value: SystemResource.PUBLICATIONS,
    label: 'PUBLICACIONES',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.RESOURCES,
    label: 'RECURSOS',
    actions: [
      { value: 'read', label: 'Ver' },
      { value: 'create', label: 'Crear' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.EXTERNAL,
    label: 'TRAMITES EXTERNOS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.INTERNAL,
    label: 'TRAMITES INTERNOS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.PROCUREMENT,
    label: 'TRAMITES CONTRATACIONES',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.REPORTS,
    label: 'REPORTES',
    actions: [
      { value: reportType.APPLICANT, label: 'Solicitante' },
      { value: reportType.SEARCH, label: 'Busquedas' },
      { value: reportType.UNIT, label: 'Unidad' },
      { value: reportType.SEGMENTS, label: 'Segmentos' },
      { value: reportType.UNLINK, label: 'Desvinculacion' },
      { value: reportType.HISTORY, label: 'Historial' },
      { value: reportType.EFFICIENCY, label: 'Eficiencia' },
    ],
  },
];
