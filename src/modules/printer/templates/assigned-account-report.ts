import type {  TDocumentDefinitions } from 'pdfmake/interfaces';

interface ReportOptions {
  fullName: string;
  jobTitle: string;
  login: string;
  password: string;
  dependency: string;
}

export const getAccountAssignmentReport = (options: ReportOptions): TDocumentDefinitions => {
  const { fullName, jobTitle, login, password, dependency } = options;

  const docDefinition: TDocumentDefinitions = {
    content: [
      {
        alignment: 'center',
        fontSize: 10,
        table: {
          heights: 10,
          widths: [70, 300, '*'],
          body: [
            [
              { rowSpan: 4, image: 'src/assets/escudo.png', fit: [100, 70] },
              {
                rowSpan: 2,
                text: 'GOBIERNO ELECTRÓNICO',
              },
              { text: 'SF-000-74-RG26' },
            ],
            ['', '', 'version 1'],
            [
              '',
              {
                rowSpan: 2,
                text: 'ASIGNACION DE USUARIO DE SISTEMA DE SEGUIMIENTO DE TRAMITES',
              },
              `Aprobacion: 20/02/2020`,
            ],
            ['', '', 'pagina 1 de 1'],
          ],
        },
      },
      {
        text: `Fecha: ${new Date().toLocaleString()}`,
        marginTop: 20,
        style: 'header',
        alignment: 'right',
      },
      {
        marginTop: 50,
        text: [
          'NOMBRE: ',
          {
            text: `${fullName}\n\n`.toUpperCase(),
            bold: false,
          },
          'CARGO: ',
          {
            text: `${jobTitle}\n\n`,
            bold: false,
          },
          'UNIDAD: ',
          {
            text: `${dependency}`.toUpperCase(),
            bold: false,
          },
        ],
        style: 'header',
        alignment: 'center',
        fontSize: 12,
      },
      {
        text: [
          'Usuario: ',
          { text: `${login}\n\n`, bold: false },
          'Contraseña: ',
          { text: `${password ? password : '*********'}\n\n`, bold: false },
        ],
        style: 'header',
        alignment: 'center',
        fontSize: 12,
      },
      {
        text: 'La contraseña ingresada en el reporte debe ser cambiada una vez ingresada al sistema para que sea solo de conocimiento del usuario ',
        style: 'header',
        alignment: 'center',
        fontSize: 10,
      },
      {
        text: '\n\nEs responsabilidad del usuario el uso de la cuenta asignada\n\n',
        style: 'header',
        alignment: 'center',
        fontSize: 10,
        marginBottom: 50,
      },
      {
        qr: `${fullName} / : ${jobTitle}`,
        alignment: 'right',
        fit: 100,
      },
      {
        marginTop: 20,
        columns: [
          {
            width: 90,
            text: '',
          },
          {
            width: '*',
            text: 'Sello y firma \n USUARIO',
            alignment: 'center',
          },
          {
            width: '*',
            text: 'Sello y firma \n ADMINISTRADOR',
            alignment: 'center',
          },
          {
            width: 90,
            text: '',
          },
        ],
      },
    ],
  };

  return docDefinition;
};
