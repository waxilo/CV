import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, or } from 'drizzle-orm';
import { createDb, resumes, templates } from '../db';
import { generateId } from '../utils/jwt';
import { authMiddleware, type AuthVariables } from '../middleware/auth';
import { createDefaultResumeData, type IResumeData } from '../types/resume';
import { getBuiltinTemplate, normalizeIncomingConfig } from '../template/schema';

const createSchema = z.object({
  title: z.string().min(1).max(100).default('未命名简历'),
  template_id: z.string().optional(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug 仅支持小写字母、数字和连字符')
    .optional(),
});

const updateSchema = z.object({
  resume_id: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  data: z.record(z.unknown()).optional(),
  template_id: z.string().optional(),
  is_public: z.boolean().optional(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

const idSchema = z.object({
  resume_id: z.string().uuid(),
});

export const resumeRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

resumeRoutes.use('*', authMiddleware);

/**
 * 解析可用模板配置。
 * 内置模板不入库，优先从代码查找；否则查用户自有或历史内置库记录。
 */
async function resolveUsableTemplateConfig(
  db: ReturnType<typeof createDb>,
  templateId: string,
  userId: string
): Promise<{ primaryColor?: string; fontFamily?: string; fontSize?: number; spacing?: number } | null> {
  const builtin = getBuiltinTemplate(templateId);
  if (builtin) {
    return normalizeIncomingConfig(builtin.config) as {
      primaryColor?: string;
      fontFamily?: string;
      fontSize?: number;
      spacing?: number;
    };
  }

  const tplRows = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, templateId),
        eq(templates.isDeleted, false),
        or(eq(templates.isBuiltin, true), eq(templates.userId, userId))
      )
    )
    .limit(1);

  if (!tplRows[0]) return null;

  return normalizeIncomingConfig(tplRows[0].config) as {
    primaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
    spacing?: number;
  };
}

/** POST /api/resume-service/v1/create-resume */
resumeRoutes.post('/create-resume', async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: parsed.error.errors[0].message },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = generateId();
  const title = parsed.data.title;
  const slug = parsed.data.slug || `resume-${id.slice(0, 8)}`;
  const templateId = parsed.data.template_id || 'modern';

  const cfg = await resolveUsableTemplateConfig(db, templateId, user.sub);
  if (!cfg) {
    return c.json(
      { success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在或无权使用' },
      404
    );
  }

  const data = createDefaultResumeData();
  data.metadata.templateId = templateId;
  if (cfg.primaryColor) data.metadata.theme.primaryColor = cfg.primaryColor;
  if (cfg.fontFamily) data.metadata.theme.fontFamily = cfg.fontFamily;
  if (cfg.fontSize) data.metadata.theme.fontSize = cfg.fontSize;
  if (cfg.spacing) data.metadata.theme.spacing = cfg.spacing;

  await db.insert(resumes).values({
    id,
    userId: user.sub,
    title,
    slug,
    data,
    templateId,
  });

  return c.json({
    success: true,
    code: '0',
    message: '创建成功',
    data: { resume_id: id, title, slug, template_id: templateId, data },
  });
});

/** POST /api/resume-service/v1/list-resumes */
resumeRoutes.post('/list-resumes', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({
      id: resumes.id,
      title: resumes.title,
      slug: resumes.slug,
      templateId: resumes.templateId,
      isPublic: resumes.isPublic,
      data: resumes.data,
      updatedAt: resumes.updatedAt,
      createdAt: resumes.createdAt,
    })
    .from(resumes)
    .where(and(eq(resumes.userId, user.sub), eq(resumes.isDeleted, false)))
    .orderBy(desc(resumes.updatedAt));

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: rows.map((r) => ({
      resume_id: r.id,
      title: r.title,
      slug: r.slug,
      template_id: r.templateId,
      is_public: r.isPublic,
      data: r.data,
      updated_at: r.updatedAt,
      created_at: r.createdAt,
    })),
  });
});

/** POST /api/resume-service/v1/get-detail */
resumeRoutes.post('/get-detail', async (c) => {
  const body = await c.req.json();
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: 'resume_id 无效' },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(resumes)
    .where(
      and(
        eq(resumes.id, parsed.data.resume_id),
        eq(resumes.userId, user.sub),
        eq(resumes.isDeleted, false)
      )
    )
    .limit(1);

  const resume = rows[0];
  if (!resume) {
    return c.json(
      { success: false, code: 'RESUME_NOT_FOUND', message: '简历不存在' },
      404
    );
  }

  return c.json({
    success: true,
    code: '0',
    message: 'Success',
    data: {
      resume_id: resume.id,
      title: resume.title,
      slug: resume.slug,
      template_id: resume.templateId,
      is_public: resume.isPublic,
      data: resume.data as IResumeData,
      updated_at: resume.updatedAt,
      created_at: resume.createdAt,
    },
  });
});

/** POST /api/resume-service/v1/update-resume */
resumeRoutes.post('/update-resume', async (c) => {
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: parsed.error.errors[0].message },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);
  const { resume_id, title, data, template_id, is_public, slug } = parsed.data;

  const rows = await db
    .select()
    .from(resumes)
    .where(
      and(eq(resumes.id, resume_id), eq(resumes.userId, user.sub), eq(resumes.isDeleted, false))
    )
    .limit(1);

  if (!rows[0]) {
    return c.json(
      { success: false, code: 'RESUME_NOT_FOUND', message: '简历不存在' },
      404
    );
  }

  const patch: Partial<typeof resumes.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (title !== undefined) patch.title = title;
  if (data !== undefined) patch.data = data;
  if (template_id !== undefined) {
    const cfg = await resolveUsableTemplateConfig(db, template_id, user.sub);
    if (!cfg) {
      return c.json(
        { success: false, code: 'TEMPLATE_NOT_FOUND', message: '模板不存在或无权使用' },
        404
      );
    }
    patch.templateId = template_id;
  }
  if (is_public !== undefined) patch.isPublic = is_public;
  if (slug !== undefined) patch.slug = slug;

  await db.update(resumes).set(patch).where(eq(resumes.id, resume_id));

  return c.json({
    success: true,
    code: '0',
    message: '更新成功',
    data: { resume_id },
  });
});

/** POST /api/resume-service/v1/delete-resume */
resumeRoutes.post('/delete-resume', async (c) => {
  const body = await c.req.json();
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, code: 'COMMON_PARAM_invalidRequest', message: 'resume_id 无效' },
      400
    );
  }

  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(resumes)
    .where(
      and(
        eq(resumes.id, parsed.data.resume_id),
        eq(resumes.userId, user.sub),
        eq(resumes.isDeleted, false)
      )
    )
    .limit(1);

  if (!rows[0]) {
    return c.json(
      { success: false, code: 'RESUME_NOT_FOUND', message: '简历不存在' },
      404
    );
  }

  await db
    .update(resumes)
    .set({
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(resumes.id, parsed.data.resume_id));

  return c.json({ success: true, code: '0', message: '删除成功' });
});
