import { ExternalProcedure, InternalProcedure, ProcurementProcedure } from '../../schemas';

type procedure = ExternalProcedure | InternalProcedure | ProcurementProcedure;
export interface ValidProcedureService {
  getDetail(procedureId: string): Promise<procedure>;
}
