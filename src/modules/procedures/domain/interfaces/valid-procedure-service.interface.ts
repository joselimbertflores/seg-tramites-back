import { ExternalProcedure, InternalProcedure, ProcurementProcedure } from '../../schemas';

type procedure = ExternalProcedure | InternalProcedure | ProcurementProcedure;
export interface validProcedureService {
  getDetail(procedureId: string): Promise<procedure>;
}
