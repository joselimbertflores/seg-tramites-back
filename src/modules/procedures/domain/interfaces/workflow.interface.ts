export interface workflow {
  _id: ID;
  dispatches: dispatch[];
}

export interface ID {
  emitter: participant;
  outboundDate: Date;
}

export interface dispatch {
  _id: string;
  attachmentQuantity: string;
  internalNumer: string;
  receiver: participant;
  reference: string;
  status: string;
  inboundDate?: Date;
  eventLog?: eventLog;
}

export interface eventLog {
  manager: string;
  description: string;
  date: string;
}

export interface participant {
  cuenta: string;
  fullname: string;
  jobtitle: string;
}
