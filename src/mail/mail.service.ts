import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from 'sib-api-v3-sdk';

@Injectable()
export class MailService {
  private readonly apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly logger = new Logger(MailService.name);

  constructor(configService: ConfigService) {
    this.senderEmail = configService.get<string>('BREVO_SENDER_EMAIL', '').trim();
    this.senderName = configService.get<string>('BREVO_SENDER_NAME', '').trim();

    if (!this.senderEmail || !this.senderName) {
      this.logger.error('Sender configuration missing: revise BREVO_SENDER_EMAIL y BREVO_SENDER_NAME');
      throw new Error('Brevo sender configuration missing');
    }

    const client = SibApiV3Sdk.ApiClient.instance;
    const apiKey = configService.get<string>('BREVO_API_KEY', '').trim();

    if (!apiKey) {
      this.logger.error('BREVO_API_KEY no definido');
      throw new Error('Brevo API key missing');
    }

    client.authentications['api-key'].apiKey = apiKey;
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  async sendReservaEmail(
    email: string,
    nombre: string,
    fecha: string,
    ambiente: string,
    horario: { inicio: string; fin: string },
    equipos?: { nombre: string; cantidad: number }[],
  ): Promise<void> {
    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const equiposContenido = equipos && equipos.length > 0
      ? `<p><b>Equipos reservados:</b></p>
        <ul>
          ${equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = 'Confirmación de reserva';
    emailData.htmlContent = `
        <h2>Reserva confirmada</h2>
        <p>Hola ${nombre},</p>
        <p>Tu reserva fue registrada correctamente.</p>
        <ul>
          <li><b>Ambiente:</b> ${ambiente}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Horario:</b> ${horario.inicio} - ${horario.fin}</li>
        </ul>
        ${equiposContenido}
        <p>Gracias por usar el sistema.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Correo enviado a ${email} (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando correo de reserva', error as Error);
    }
  }
}
