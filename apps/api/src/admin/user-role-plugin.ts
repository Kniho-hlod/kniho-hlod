import {
  createRequireRole,
  createVerifyToken,
  HttpError,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { FieldConfig, ModelRouteOverrides, ProjectPlugin } from '@eleansphere/be-core';
import { ADMIN_ROLE, userEntity, USER_ROLES, USERS_PATH } from '@kniho-hlod/domain';
import type { SetUserRoleRequest, UserRole } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;

const FORBIDDEN = 403;
const NOT_FOUND = 404;
/** The user's `role` field, but required: it is all this request says. */
const ROLE_FIELDS: Record<string, FieldConfig> = {
  role: { type: 'ENUM', values: [...USER_ROLES], required: true },
};

export interface UserRolePluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  /** Shapes the answer like the accounts in `GET /api/users` (`routes.user.enrich`). */
  userOverview: Enrich;
}

function readRoleRequest(body: unknown): SetUserRoleRequest {
  const request = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const issues = validateFields(ROLE_FIELDS, request, { mode: 'create' });
  if (issues.length > 0) throw new ValidationError(issues);
  return { role: request.role as UserRole };
}

/**
 * `PUT /api/users/:id/role` — administrators make an account an administrator, or a reader again.
 * Never their own: so nobody locks themselves out, and an administrator is always left. The
 * account's access tokens carry the old role until they are renewed (within minutes).
 */
export function createUserRolePlugin({
  jwtSecret,
  registry,
  userOverview,
}: UserRolePluginOptions): ProjectPlugin {
  return {
    registerRoutes(app) {
      app.put(
        `${USERS_PATH}/:id/role`,
        createVerifyToken(jwtSecret),
        createRequireRole(ADMIN_ROLE),
        asyncHandler(async (req, res) => {
          const { role } = readRoleRequest(req.body);
          if (req.params.id === req.user?.id) {
            throw new HttpError(FORBIDDEN, "Administrators can't change their own role");
          }
          const user = await registry.get(userEntity.config.name).findByPk(req.params.id);
          if (!user) throw new HttpError(NOT_FOUND, 'user not found');
          await user.update({ role });
          const [overview] = await userOverview([user]);
          res.json(overview);
        })
      );
    },
  };
}
