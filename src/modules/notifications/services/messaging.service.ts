import { Injectable } from '@nestjs/common';

@Injectable()
export class MessagingService {
  // async sendTextMessage(params: params) {
  //   const response = await axios({
  //     url: 'https://graph.facebook.com/v22.0/number/messages',
  //     method: 'post',
  //     headers: {
  //       Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  //       'Content-Type': 'application/json',
  //     },
  //     data: JSON.stringify({
  //       messaging_product: 'whatsapp',
  //       to: '59177460463',
  //       type: 'template',
  //       template: {
  //         name: 'confirmacion_tramite_concluido',
  //         language: {
  //           code: 'es_MX',
  //         },
  //         components: [
  //           {
  //             type: 'body',
  //             parameters: [
  //               {
  //                 type: 'text',
  //                 text: params.fullName,
  //               },
  //               {
  //                 type: 'text',
  //                 text: params.code,
  //               },
  //               {
  //                 type: 'text',
  //                 text: params.state,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     }),
  //   });
  //   console.log(response);
  // }
}
