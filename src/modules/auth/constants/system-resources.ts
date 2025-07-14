import { reportType } from 'src/modules/reports/enums/report-types.enum';

export enum SystemResource {
  USERS = 'user',
  ROLES = 'roles',

  INSTITUTIONS = 'institutions',
  DEPENDENCIES = 'dependencies',
  OFFICERS = 'officers',
  ACCOUNTS = 'accounts',
  TYPES_PROCEDURES = 'types-procedures',

  EXTERNAL = 'external',
  INTERNAL = 'internal',
  PROCUREMENT = 'procurement',
  REPORTS = 'reports',
  RESOURCES = 'resources',
  PUBLICATIONS = 'publications',
  communication = 'communication',
  groupware = 'groupware',
  archived = 'archived',
  jobs = 'jobs',
}

export const SYSTEM_RESOURCES = [
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
    value: SystemResource.INSTITUTIONS,
    label: 'Instituciones',
    actions: [
      { value: 'read', label: 'Ver' },
      { value: 'create', label: 'Crear' },
      { value: 'update', label: 'Editar' },
    ],
  },
  {
    value: SystemResource.DEPENDENCIES,
    label: 'Dependencias',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
    ],
  },
  {
    value: SystemResource.OFFICERS,
    label: 'Funcionarios',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },

  {
    value: SystemResource.ACCOUNTS,
    label: 'Cuentas',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.USERS,
    label: 'Usuarios',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.ROLES,
    label: 'Roles',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
      { value: 'delete', label: 'Eliminar' },
    ],
  },
  {
    value: SystemResource.TYPES_PROCEDURES,
    label: 'TIPOS DE TRAMITES',
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
    value: SystemResource.archived,

    label: 'ARCHIVOS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar' },
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
    value: SystemResource.communication,
    label: 'BANDEJAS',
    actions: [
      { value: 'create', label: 'Crear' },
      { value: 'read', label: 'Ver' },
      { value: 'update', label: 'Editar ' },
      { value: 'delete', label: 'Actualizar' },
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
export const PROCEDURES = [
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
];
