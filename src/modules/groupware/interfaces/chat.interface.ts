export class IChatData {
  toUser: string;
  payload: IChatPayload;
}

export interface IChatPayload {
  chat: object;
  message: object;
}
