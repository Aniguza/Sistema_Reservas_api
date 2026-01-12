import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from 'sib-api-v3-sdk';

@Injectable()
export class MailService {
  private readonly apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly adminEmail: string | null;
  private readonly logger = new Logger(MailService.name);

  constructor(configService: ConfigService) {
    this.senderEmail = configService.get<string>('BREVO_SENDER_EMAIL', '').trim();
    this.senderName = configService.get<string>('BREVO_SENDER_NAME', '').trim();

    this.adminEmail = (configService.get<string>('BREVO_ADMIN_EMAIL') || '').trim() || null;

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

  async sendReservaEmail(params: {
    email: string;
    nombre: string;
    fecha: string;
    ambiente: string;
    horario: { inicio: string; fin: string };
    equipos?: { nombre: string; cantidad: number }[];
    codigoReserva: string;
    codigoAlumno: string;
  }): Promise<void> {
    const { email, nombre, fecha, ambiente, horario, equipos, codigoReserva, codigoAlumno } = params;
    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const nombreMayus = nombre ? nombre.toUpperCase() : '';

    const equiposContenido = equipos && equipos.length > 0
      ? `<p><b>Equipos reservados:</b></p>
        <ul>
          ${equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = `Respuesta al Caso ${codigoReserva} - ${codigoAlumno} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Reserva confirmada</h2>
        <p>Hola ${nombre},</p>
        <p>Tu reserva fue registrada correctamente.</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Código de alumno:</b> ${codigoAlumno}</li>
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

  async sendReprogramacionEmail(params: {
    email: string;
    nombre: string;
    codigoReserva: string;
    codigoAlumno: string;
    fechaAnterior: string;
    fechaNueva: string;
    horarioAnterior: { inicio: string; fin: string };
    horarioNuevo: { inicio: string; fin: string };
    ambiente: string;
    motivo: string;
    equipos?: { nombre: string; cantidad: number }[];
  }): Promise<void> {
    const {
      email,
      nombre,
      codigoReserva,
      codigoAlumno,
      fechaAnterior,
      fechaNueva,
      horarioAnterior,
      horarioNuevo,
      ambiente,
      motivo,
      equipos,
    } = params;

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const nombreMayus = nombre ? nombre.toUpperCase() : '';

    const equiposContenido = equipos && equipos.length > 0
      ? `<p><b>Equipos asociados:</b></p>
        <ul>
          ${equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = `Actualización de la reserva ${codigoReserva} - ${codigoAlumno} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Reprogramación de reserva</h2>
        <p>Hola ${nombre},</p>
        <p>Tu reserva ${codigoReserva} ha sido reprogramada.</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Código de alumno:</b> ${codigoAlumno}</li>
          <li><b>Ambiente:</b> ${ambiente}</li>
        </ul>
        <p><b>Detalle de cambios:</b></p>
        <ul>
          <li><b>Fecha anterior:</b> ${fechaAnterior}</li>
          <li><b>Horario anterior:</b> ${horarioAnterior.inicio} - ${horarioAnterior.fin}</li>
          <li><b>Nueva fecha:</b> ${fechaNueva}</li>
          <li><b>Nuevo horario:</b> ${horarioNuevo.inicio} - ${horarioNuevo.fin}</li>
        </ul>
        ${equiposContenido}
        <p><b>Motivo:</b> ${motivo}</p>
        <p>Gracias por usar el sistema.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Reprogramación notificada a ${email} (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando correo de reprogramación', error as Error);
    }
  }

  async sendCancelacionEmail(params: {
    email: string;
    nombre: string;
    codigoReserva: string;
    codigoAlumno: string;
    fecha: string;
    horario: { inicio: string; fin: string };
    ambiente: string;
    motivoCancelacion: string;
  }): Promise<void> {
    const { email, nombre, codigoReserva, codigoAlumno, fecha, horario, ambiente, motivoCancelacion } = params;

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const nombreMayus = nombre ? nombre.toUpperCase() : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = `Cancelación de la reserva ${codigoReserva} - ${codigoAlumno} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Reserva cancelada</h2>
        <p>Hola ${nombre},</p>
        <p>Tu reserva ${codigoReserva} ha sido cancelada.</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Código de alumno:</b> ${codigoAlumno}</li>
          <li><b>Ambiente:</b> ${ambiente}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Horario:</b> ${horario.inicio} - ${horario.fin}</li>
        </ul>
        <p><b>Motivo de cancelación:</b> ${motivoCancelacion}</p>
        <p>Si necesitas una nueva reserva, puedes registrarla en el sistema.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Cancelación notificada a ${email} (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando correo de cancelación', error as Error);
    }
  }

  async sendIncidenciaEmail(params: {
    email: string;
    nombre: string;
    codigoReserva: string;
    codigoAlumno: string;
    fechaReserva: string;
    ambiente: string;
    incidencia: {
      id: string;
      descripcion: string;
      tipo: string;
      prioridad: string;
      estado: string;
      fechaReporte: string;
      reportadoPor: string;
    };
  }): Promise<void> {
    const { email, nombre, codigoReserva, codigoAlumno, fechaReserva, ambiente, incidencia } = params;

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const nombreMayus = nombre ? nombre.toUpperCase() : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = `Incidencia registrada - ${codigoReserva} - ${codigoAlumno} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Nueva incidencia en tu reserva</h2>
        <p>Hola ${nombre},</p>
        <p>Se registró una incidencia para la reserva ${codigoReserva}.</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Código de alumno:</b> ${codigoAlumno}</li>
          <li><b>Ambiente:</b> ${ambiente}</li>
          <li><b>Fecha de reserva:</b> ${fechaReserva}</li>
        </ul>
        <p><b>Detalle de la incidencia:</b></p>
        <ul>
          <li><b>Descripción:</b> ${incidencia.descripcion}</li>
          <li><b>Tipo:</b> ${incidencia.tipo}</li>
          <li><b>Prioridad:</b> ${incidencia.prioridad}</li>
          <li><b>Estado:</b> ${incidencia.estado}</li>
          <li><b>Fecha de reporte:</b> ${incidencia.fechaReporte}</li>
        </ul>
        <p>Nos comunicaremos contigo si se requiere más información.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Incidencia notificada a ${email} (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando correo de incidencia', error as Error);
    }
  }

  async notifyReservaAdmin(
    data: {
      reservaId: string;
      usuario: string;
      correoUsuario: string;
      fecha: string;
      ambiente: string;
      horario: { inicio: string; fin: string };
      tipo: string;
      motivo: string;
      equipos?: { nombre: string; cantidad: number }[];
      codigoReserva: string;
      codigoAlumno: string;
    },
  ): Promise<void> {
    if (!this.adminEmail) {
      this.logger.warn('BREVO_ADMIN_EMAIL no configurado; omitiendo notificación de administrador');
      return;
    }

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const adminRecipient = new SibApiV3Sdk.SendSmtpEmailTo();
    adminRecipient.email = this.adminEmail;
    adminRecipient.name = 'Administrador Reservas';

    const equiposContenido = data.equipos && data.equipos.length > 0
      ? `<p><b>Equipos solicitados:</b></p>
        <ul>
          ${data.equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const nombreMayus = data.usuario ? data.usuario.toUpperCase() : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [adminRecipient];
    emailData.subject = `Nueva reserva registrada - ${data.codigoReserva} - ${data.codigoAlumno} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Nueva reserva confirmada</h2>
        <p>Se registró una nueva reserva (${data.reservaId}).</p>
        <ul>
          <li><b>Código de reserva:</b> ${data.codigoReserva}</li>
          <li><b>Código de alumno:</b> ${data.codigoAlumno}</li>
          <li><b>Usuario:</b> ${data.usuario} (${data.correoUsuario})</li>
          <li><b>Tipo:</b> ${data.tipo}</li>
          <li><b>Ambiente:</b> ${data.ambiente}</li>
          <li><b>Fecha:</b> ${data.fecha}</li>
          <li><b>Horario:</b> ${data.horario.inicio} - ${data.horario.fin}</li>
        </ul>
        <p><b>Motivo:</b> ${data.motivo}</p>
        ${equiposContenido}
      `;

    try {
      await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Notificación enviada a administrador por reserva ${data.reservaId}`);
    } catch (error) {
      this.logger.error('Error enviando notificación a administrador', error as Error);
    }
  }

  async sendAsistenteAsignadoEmail(params: {
    email: string;
    nombre: string;
    codigoReserva: string;
    solicitante: string;
    fecha: string;
    ambiente: string;
    horario: { inicio: string; fin: string };
    equipos?: { nombre: string; cantidad: number }[];
  }): Promise<void> {
    const { email, nombre, codigoReserva, solicitante, fecha, ambiente, horario, equipos } = params;

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const nombreMayus = nombre ? nombre.toUpperCase() : '';

    const equiposContenido = equipos && equipos.length > 0
      ? `<p><b>Equipos asociados a la reserva:</b></p>
        <ul>
          ${equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = `Asistente asignado - Reserva ${codigoReserva} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Asistente asignado a reserva</h2>
        <p>Hola ${nombre},</p>
        <p>Has sido asignado como asistente para la siguiente reserva:</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Solicitante:</b> ${solicitante}</li>
          <li><b>Ambiente:</b> ${ambiente}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Horario:</b> ${horario.inicio} - ${horario.fin}</li>
        </ul>
        ${equiposContenido}
        <p><b>Responsabilidades del asistente:</b></p>
        <ul>
          <li>Asegurarse de que el ambiente esté preparado antes del horario de la reserva</li>
          <li>Verificar que los equipos estén funcionando correctamente</li>
          <li>Asistir al usuario durante el uso de las instalaciones</li>
          <li>Reportar cualquier incidencia que ocurra durante la reserva</li>
        </ul>
        <p>Si tienes alguna duda o inconveniente, por favor contacta al administrador del sistema.</p>
        <p>Gracias por tu colaboración.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Correo de asignación enviado a asistente ${email} (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando correo de asignación a asistente', error as Error);
      throw error;
    }
  }

  async notifyCancelacionAsistenteAdmin(params: {
    asistentesAsignados?: { nombre: string; correo: string }[];
    codigoReserva: string;
    solicitante: string;
    fecha: string;
    ambiente: string;
    horario: { inicio: string; fin: string };
    motivoCancelacion: string;
    equipos?: { nombre: string; cantidad: number }[];
  }): Promise<void> {
    const { asistentesAsignados, codigoReserva, solicitante, fecha, ambiente, horario, motivoCancelacion, equipos } = params;

    // Si hay asistentes asignados, enviar correo a cada uno
    if (asistentesAsignados && asistentesAsignados.length > 0) {
      for (const asistente of asistentesAsignados) {
        try {
          await this.sendCancelacionAsistenteEmail({
            email: asistente.correo,
            nombre: asistente.nombre,
            codigoReserva,
            solicitante,
            fecha,
            ambiente,
            horario,
            motivoCancelacion,
            equipos,
          });
        } catch (error) {
          this.logger.error(`Error enviando correo de cancelación a asistente ${asistente.correo}`, error as Error);
        }
      }
    } else {
      // Si no hay asistentes asignados, enviar correo a administradores
      await this.sendCancelacionAdminEmail({
        codigoReserva,
        solicitante,
        fecha,
        ambiente,
        horario,
        motivoCancelacion,
        equipos,
      });
    }
  }

  private async sendCancelacionAsistenteEmail(params: {
    email: string;
    nombre: string;
    codigoReserva: string;
    solicitante: string;
    fecha: string;
    ambiente: string;
    horario: { inicio: string; fin: string };
    motivoCancelacion: string;
    equipos?: { nombre: string; cantidad: number }[];
  }): Promise<void> {
    const { email, nombre, codigoReserva, solicitante, fecha, ambiente, horario, motivoCancelacion, equipos } = params;

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const recipient = new SibApiV3Sdk.SendSmtpEmailTo();
    recipient.email = email;
    recipient.name = nombre;

    const nombreMayus = nombre ? nombre.toUpperCase() : '';

    const equiposContenido = equipos && equipos.length > 0
      ? `<p><b>Equipos asociados a la reserva:</b></p>
        <ul>
          ${equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [recipient];
    emailData.subject = `Cancelación de reserva asignada - ${codigoReserva} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Reserva asignada cancelada</h2>
        <p>Hola ${nombre},</p>
        <p>La reserva que tenías asignada como asistente ha sido cancelada:</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Solicitante:</b> ${solicitante}</li>
          <li><b>Ambiente:</b> ${ambiente}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Horario:</b> ${horario.inicio} - ${horario.fin}</li>
        </ul>
        ${equiposContenido}
        <p><b>Motivo de cancelación:</b> ${motivoCancelacion}</p>
        <p>Esta reserva ya no requiere tu asistencia.</p>
        <p>Gracias por tu atención.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Correo de cancelación enviado a asistente ${email} (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando correo de cancelación a asistente', error as Error);
      throw error;
    }
  }

  private async sendCancelacionAdminEmail(params: {
    codigoReserva: string;
    solicitante: string;
    fecha: string;
    ambiente: string;
    horario: { inicio: string; fin: string };
    motivoCancelacion: string;
    equipos?: { nombre: string; cantidad: number }[];
  }): Promise<void> {
    if (!this.adminEmail) {
      this.logger.warn('BREVO_ADMIN_EMAIL no configurado; omitiendo notificación de cancelación a administrador');
      return;
    }

    const { codigoReserva, solicitante, fecha, ambiente, horario, motivoCancelacion, equipos } = params;

    const sender = new SibApiV3Sdk.SendSmtpEmailSender();
    sender.email = this.senderEmail;
    sender.name = this.senderName;

    const adminRecipient = new SibApiV3Sdk.SendSmtpEmailTo();
    adminRecipient.email = this.adminEmail;
    adminRecipient.name = 'Administrador Reservas';

    const equiposContenido = equipos && equipos.length > 0
      ? `<p><b>Equipos asociados a la reserva:</b></p>
        <ul>
          ${equipos.map((item) => `<li>${item.cantidad} x ${item.nombre}</li>`).join('')}
        </ul>`
      : '';

    const nombreMayus = solicitante ? solicitante.toUpperCase() : '';

    const emailData = new SibApiV3Sdk.SendSmtpEmail();
    emailData.sender = sender;
    emailData.to = [adminRecipient];
    emailData.subject = `Reserva cancelada - ${codigoReserva} - ${nombreMayus}`;
    emailData.htmlContent = `
        <h2>Reserva cancelada</h2>
        <p>Una reserva ha sido cancelada.</p>
        <ul>
          <li><b>Código de reserva:</b> ${codigoReserva}</li>
          <li><b>Solicitante:</b> ${solicitante}</li>
          <li><b>Ambiente:</b> ${ambiente}</li>
          <li><b>Fecha:</b> ${fecha}</li>
          <li><b>Horario:</b> ${horario.inicio} - ${horario.fin}</li>
        </ul>
        <p><b>Motivo de cancelación:</b> ${motivoCancelacion}</p>
        ${equiposContenido}
        <p>La reserva ya no requiere asignación de asistente.</p>
      `;

    try {
      const response = await this.apiInstance.sendTransacEmail(emailData);
      this.logger.log(`Notificación de cancelación enviada a administrador (messageId=${response?.messageId ?? 'sin id'})`);
    } catch (error) {
      this.logger.error('Error enviando notificación de cancelación a administrador', error as Error);
    }
  }
}
