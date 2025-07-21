import { SystemResource } from './system-resources';

export interface Menu {
  requiredResources?: SystemResource[];
  text: string;
  icon?: string;
  routerLink?: string;
  children?: Menu[];
}

export const FRONTEND_MENU: Menu[] = [
  {
    text: 'Seguridad y Acceso',
    children: [
      {
        requiredResources: [SystemResource.USERS],
        text: 'Usuarios',
        icon: 'account_circle',
        routerLink: 'usuarios',
      },
      {
        requiredResources: [SystemResource.ROLES],
        text: 'Roles',
        icon: 'admin_panel_settings',
        routerLink: 'roles',
      },
      {
        requiredResources: [SystemResource.USERS],
        text: 'Grupo de trabajo',
        icon: 'groups',
        routerLink: 'groupware/users',
      },
    ],
  },
  {
    text: 'Organizacion',
    children: [
      {
        requiredResources: [SystemResource.INSTITUTIONS],
        text: 'Instituciones',
        icon: 'apartment',
        routerLink: 'institutions',
      },
      {
        requiredResources: [SystemResource.DEPENDENCIES],
        text: 'Dependencias',
        icon: 'holiday_village',
        routerLink: 'dependencies',
      },
      {
        requiredResources: [SystemResource.OFFICERS],
        text: 'Funcionarios',
        icon: 'person',
        routerLink: 'officers',
      },
      {
        requiredResources: [SystemResource.ACCOUNTS],
        text: 'Cuentas',
        icon: 'account_circle',
        routerLink: 'accounts',
      },
      {
        requiredResources: [SystemResource.TYPES_PROCEDURES],
        text: 'Tipos de tramite',
        icon: 'summarize',
        routerLink: 'types-procedures',
      },
    ],
  },

  {
    text: 'Administracion',
    children: [
      {
        requiredResources: [SystemResource.EXTERNAL],
        text: 'Tramites externos',
        icon: 'folder_shared',
        routerLink: 'external',
      },
      {
        requiredResources: [SystemResource.INTERNAL],
        text: 'Tramites internos',
        icon: 'folder',
        routerLink: 'internal',
      },
      {
        requiredResources: [SystemResource.PROCUREMENT],
        text: 'Contrataciones',
        icon: 'snippet_folder',
        routerLink: 'procurement',
      },
    ],
  },
  {
    // Acceso a bandejas de trámites (si puede gestionar trámites externos o internos)
    requiredResources: [SystemResource.EXTERNAL, SystemResource.INTERNAL],
    text: 'Bandeja de entrada',
    icon: 'inbox',
    routerLink: 'inbox',
  },
  {
    requiredResources: [SystemResource.EXTERNAL, SystemResource.INTERNAL],
    text: 'Bandeja de salida',
    icon: 'outbox',
    routerLink: 'outbox',
  },
  {
    requiredResources: [SystemResource.EXTERNAL, SystemResource.INTERNAL],
    text: 'Archivos',
    icon: 'shelves',
    routerLink: 'folders',
  },
  {
    requiredResources: [SystemResource.REPORTS],
    text: 'Reportes',
    icon: 'analytics',
    routerLink: 'reports',
  },

  {
    requiredResources: [SystemResource.PUBLICATIONS],
    text: 'Publicaciones',
    icon: 'newspaper',
    routerLink: 'posts/manage',
  },

  // {
  //   resource: 'archived',
  //   text: 'Archivos',
  //   icon: 'folder_copy',
  //   routerLink: 'archives',
  // },
  // // {
  // //   resource: 'reports',
  // //   text: 'Reportes',
  // //   icon: 'equalizer',
  // //   routerLink: 'reports',
  // // },
  // {
  //   text: 'Grupo de trabajo',
  //   icon: 'equalizer',
  //   children: [
  //     {
  //       resource: 'groupware',
  //       text: 'Usuarios activos',
  //       icon: 'equalizer',
  //       routerLink: 'groupware/users',
  //     },
  //     {
  //       resource: 'publications',
  //       text: 'Publicaciones',
  //       icon: 'newspaper',
  //       routerLink: 'posts/manage',
  //     },
  //   ],
  // },
];
