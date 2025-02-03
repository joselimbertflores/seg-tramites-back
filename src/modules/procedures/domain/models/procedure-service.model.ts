import { Procedure, ProcedureDocument } from '../../schemas';

export abstract class ProcedureService {
  abstract getDetail(procedureId: string): Promise<any>;
}
