import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Procedure } from '../schemas';

@Injectable()
export class ProcedureService {
  constructor(@InjectModel(Procedure.name) private procedureModel: Model<Procedure>) {}

  async getProcedure(id: string) {
    const procedureDB = await this.procedureModel.findById(id).populate('account').populate('type', 'nombre');
    if (!procedureDB) throw new NotFoundException(`El tramite ${id} no existe.`);
    return procedureDB;
  }
}
