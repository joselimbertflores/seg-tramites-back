import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { join } from 'path';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendUserAssignment(email: string, pdfBuffer: Buffer) {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="cid:logo" alt="Logo" style="width: 120px;" />
    </div>
    <h2 style="color: #2c3e50;">Asignación de Usuario</h2>
    <p>Estimado/a usuario/a,</p>
    <p>
      Le informamos que se ha creado un usuario temporal para acceder al
      <strong>Sistema de Seguimiento de Trámites</strong>.
    </p>
    <p>
      Sus credenciales se encuentran adjuntas en el archivo PDF. Le recomendamos cambiar su contraseña al iniciar sesión por primera vez.
    </p>
    <p style="margin-top: 30px;">
      Atentamente,<br />
      <strong>Jefatura de Gobierno Electrónico</strong>
    </p>
  </div>
    `;
    await this.mailerService.sendMail({
      html,
      to: email,
      subject: 'Asignación de Usuario - Sistema de Seguimiento de Trámites'.replace('Sistema', 'hola'),
      context: {
        nombre: 'Juan',
      },
      attachments: [
        {
          filename: 'Credenciales.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: 'logo.png',
          path: join(__dirname, '..', '..', 'assets', 'gams.png'),
          cid: 'logo', // esto permite usar"lo en la plantilla
        },
      ],
    });
  }
}
