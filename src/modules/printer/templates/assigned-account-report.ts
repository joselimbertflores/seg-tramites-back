import path from 'path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Account } from 'src/modules/administration/schemas';

interface Credentials {
  login: string;
  password: string;
}

export const getAccountAssignmentReport = (
  account: Account,
  credentials: Credentials,
  generatedBy?: string,
): TDocumentDefinitions => {
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
                text: 'JEFATURA DE GOBIERNO ELECTRÓNICO',
              },
              { text: 'SF-000-74-RG26' },
            ],
            ['', '', 'version 1'],
            [
              '',
              {
                rowSpan: 2,
                text: 'FORMULARIO DE ASIGNACIÓN DE USUARIO\nSistema de Seguimiento de Trámites',
              },
              `Aprobación: 20/02/2020`,
            ],
            ['', '', 'página 1 de 1'],
          ],
        },
      },
      {
        text: `Fecha: ${new Date().toLocaleString('es-ES', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
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
          { text: 'USUARIO ASIGNADO: ', bold: true },
          { text: `${credentials.login}\n\n`, bold: false },
          { text: 'CONTRASEÑA INICIAL: ', bold: true },
          { text: `${credentials.password}\n\n`, bold: false },
        ],
        style: 'header',
        alignment: 'center',
        fontSize: 12,
      },
      {
        marginTop: 80,
        text: 'La contraseña inicial será generada automáticamente por el sistema y deberá ser cambiada en el primer ingreso, para que sea de exclusivo conocimiento del usuario.',
        style: 'header',
        alignment: 'center',
        fontSize: 10,
      },
      {
        text: '\n\nEl usuario es responsable del uso adecuado y seguro de la cuenta asignada, conforme a la normativa institucional vigente.\n\n',
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
        fontSize: 11,
        text: [
          { text: 'Administrador que asigna: ', bold: true },
          {
            text: `${generatedBy ?? ''}`.toUpperCase(),
          },
        ],
      },
      {
        text: 'Declaro haber recibido mi cuenta de acceso y acepto las condiciones de uso.',
        fontSize: 11,
        marginTop: 20,
      },
      { text: '(Registro digital) - No requiere firma manuscrita', fontSize: 11 },
    ],
  };

  return docDefinition;
};
