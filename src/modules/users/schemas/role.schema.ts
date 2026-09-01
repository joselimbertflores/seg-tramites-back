import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SYSTEM_RESOURCES, SystemResource } from 'src/modules/auth/constants';

const validActionsByResource = new Map(
  SYSTEM_RESOURCES.map(({ value, actions }) => [value, new Set(actions.map(({ value: action }) => action))]),
);

export function areValidPermissions(permissions: Permission[]): boolean {
  const resources = permissions.map(({ resource }) => resource);
  if (new Set(resources).size !== resources.length) return false;

  return permissions.every(({ resource, actions }) => {
    const validActions = validActionsByResource.get(resource);
    return validActions && actions.length > 0 && actions.every((action) => validActions.has(action));
  });
}
@Schema({ _id: false })
export class Permission {
  @Prop({
    type: String,
    enum: SystemResource,
  })
  resource: SystemResource;

  @Prop({ type: [String], minlength: 1 })
  actions: string[];
}

const PermissionSchema = SchemaFactory.createForClass(Permission);

@Schema()
export class Role extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  })
  name: string;

  @Prop({
    type: [PermissionSchema],
    default: [],
    validate: {
      validator: areValidPermissions,
      message: 'Permissions contain duplicated resources or invalid actions',
    },
  })
  permissions: Permission[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
