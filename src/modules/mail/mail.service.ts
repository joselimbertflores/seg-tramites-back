import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { join } from 'path';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendUserAssignment(email: string, login: string, password: string, pdfBuffer: Buffer) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Asignación de Usuario - Sistema de Seguimiento de Trámites',
      template: 'user-assignment',
      context: {
        login,
        password,
      },
      attachments: [
        {
          filename: 'Credenciales.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: 'logo.png',
          path: join(__dirname, '..', '..', '..', 'assets', 'gams.png'),
          cid: 'logo', // esto permite usar"lo en la plantilla
        },
      ],
    });
  }
}
