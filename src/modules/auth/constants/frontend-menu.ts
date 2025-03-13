import { SystemResource } from './system-resources';

export interface Menu {
  resource?: SystemResource[];
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
        resource: [SystemResource.USERS],
        text: 'Usuarios',
        icon: 'account_circle',
        routerLink: 'usuarios',
      },
      {
        resource: [SystemResource.ROLES],
        text: 'Roles',
        icon: 'verified_user',
        routerLink: 'roles',
      },
      {
        resource: [SystemResource.USERS],
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
        resource: [SystemResource.INSTITUTIONS],
        text: 'Instituciones',
        icon: 'apartment',
        routerLink: 'institutions',
      },
      {
        resource: [SystemResource.DEPENDENCIES],
        text: 'Dependencias',
        icon: 'holiday_village',
        routerLink: 'dependencies',
      },
      {
        resource: [SystemResource.OFFICERS],
        text: 'Funcionarios',
        icon: 'person',
        routerLink: 'officers',
      },
      {
        resource: [SystemResource.ACCOUNTS],
        text: 'Cuentas',
        icon: 'assignment_ind',
        routerLink: 'accounts',
      },
      {
        resource: [SystemResource.TYPES_PROCEDURES],
        text: 'Tramites',
        icon: 'summarize',
        routerLink: 'types-procedures',
      },
    ],
  },

  {
    text: 'Administracion',
    children: [
      {
        resource: [SystemResource.EXTERNAL],
        text: 'Tramites externos',
        icon: 'folder_shared',
        routerLink: 'manage/external',
      },
      {
        resource: [SystemResource.INTERNAL],
        text: 'Tramites internos',
        icon: 'folder',
        routerLink: 'manage/internal',
      },
      {
        resource: [SystemResource.INTERNAL],
        text: 'Contrataciones',
        icon: 'snippet_folder',
        routerLink: 'manage/procurement',
      },
    ],
  },

  {
    resource: [SystemResource.EXTERNAL, SystemResource.INTERNAL],
    text: 'Bandeja de entrada',
    icon: 'inbox',
    routerLink: 'manage/inbox',
  },
  {
    resource: [SystemResource.EXTERNAL, SystemResource.INTERNAL],
    text: 'Bandeja de salida',
    icon: 'outbox',
    routerLink: 'manage/outbox',
  },
  {
    resource: [SystemResource.EXTERNAL, SystemResource.INTERNAL],
    text: 'Archivos',
    icon: 'shelves',
    routerLink: 'manage/folders',
  },

  // {
  //   resource: 'archived',
  //   text: 'Archivos',
  //   icon: 'folder_copy',
  //   routerLink: 'archives',
  // },
  // {
  //   resource: 'reports',
  //   text: 'Reportes',
  //   icon: 'equalizer',
  //   routerLink: 'reports',
  // },
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
