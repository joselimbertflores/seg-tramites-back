import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

interface MailAccountAssigmentProps {
  type: 'ASSIGNMENT' | 'RESET';
  email: string;
  pdfBuffer: Buffer;
  attachmentName: string;
}
@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendUserAssignment({ type, email, pdfBuffer, attachmentName }: MailAccountAssigmentProps) {
    const isReset = type === 'RESET';

    const subject = isReset
      ? 'Restablecimiento de contraseña – Sistema de Seguimiento de Trámites'
      : 'Asignación de usuario – Sistema de Seguimiento de Trámites';

    const title = isReset ? 'Restablecimiento de contraseña' : 'Asignación de usuario';

    const description = isReset
      ? 'Se ha realizado el restablecimiento de su contraseña de acceso al sistema.'
      : 'Se le ha habilitado un usuario para el acceso al sistema.';

    const html = `
  <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f4f6f8;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 24px; border-radius: 6px;">
    
      <h2 style="color: #1f3a5f; text-align: center;">
        ${title}
      </h2>

      <p style="color: #333;">
        Estimado/a funcionario/a:
      </p>

      <p style="color: #333;">
        ${description}
      </p>

      <p style="color: #333;">
        Sus credenciales se encuentran adjuntas en el archivo PDF.
        Por motivos de seguridad, se recomienda cambiar la contraseña al iniciar sesión.
      </p>

      <p style="color: #555; font-size: 13px; margin-top: 24px;">
        Si usted no solicitó este acceso o considera que se trata de un error,
        por favor comuníquese con la unidad de Gobierno Electrónico.
      </p>

      <hr style="margin: 24px 0;" />

      <p style="color: #333;">
        Atentamente,<br />
        <strong>
          Jefatura de Gobierno Electrónico<br />
          Gobierno Autónomo Municipal de Sacaba
        </strong>
      </p>

    </div>
  </div>
  `;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        html,
        attachments: [
          {
            filename: `${attachmentName.toUpperCase().trim()}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      return {
        ok: true,
        message: `El correo fue enviado correctamente a ${email}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: `No se pudo enviar el correo a la dirección ${email}`,
      };
    }
  }
}
