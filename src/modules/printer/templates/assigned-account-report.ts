import path from 'path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Account } from 'src/modules/administration/schemas';

interface Credentials {
  login: string;
  password: string;
}

export const getAccountAssignmentReport = (account: Account, credentials: Credentials): TDocumentDefinitions => {
  const fullName = account.officer?.fullName || 'Sin asignar';
  const jobTitle = account.jobtitle || 'Sin cargo';
  const imagePath = path.join(__dirname, '..', '..', '..', 'assets', 'escudo.png');
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        alignment: 'center',
        fontSize: 10,
        table: {
          heights: 10,
          widths: [70, 300, '*'],
          body: [
            [
              { rowSpan: 4, image: imagePath, fit: [100, 70] },
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
          { text: 'NOMBRE: ', bold: true },
          {
            text: `${fullName}\n\n`.toUpperCase(),
            bold: false,
          },
          { text: 'CARGO: ', bold: true },
          {
            text: `${account.jobtitle}\n\n`,
            bold: false,
          },
          { text: 'UNIDAD: ', bold: true },
          {
            text: `${account.dependencia.nombre}\n\n`.toUpperCase(),
            bold: false,
          },
        ],
        style: 'header',
        alignment: 'center',
        fontSize: 12,
      },
      {
        text: [
          { text: 'USUARIO: ', bold: true },
          { text: `${credentials.login}\n\n`, bold: false },
          { text: 'CONTRASEÑA: ', bold: true },
          { text: `${credentials.password}\n\n`, bold: false },
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
        qr: `${fullName} / ${jobTitle}`,
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
