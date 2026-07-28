/**
 * Backend template schema unit checks (no test runner — runnable via tsx/node if needed)
 * Vitest-style assertions kept colocated for documentation; executed by frontend suite for DSL parity.
 */
import { normalizeIncomingConfig, templateConfigSchema, assertSafeCss } from './schema';

export function runTemplateSchemaSelfCheck(): string[] {
  const errors: string[] = [];

  const legacy = normalizeIncomingConfig({
    layout: 'sidebar-left',
    primaryColor: '#2563eb',
    fontFamily: 'Inter',
    fontSize: 14,
    spacing: 1.15,
  });
  const parsed = templateConfigSchema.safeParse(legacy);
  if (!parsed.success) errors.push('legacy migrate failed');

  if (!assertSafeCss('@import url(x)')) errors.push('css should reject import');
  if (assertSafeCss('.a{color:red}')) errors.push('safe css should pass');

  const badHtml = {
    schemaVersion: 1 as const,
    layout: 'single-column' as const,
    primaryColor: '#000',
    fontFamily: 'Inter',
    fontSize: 14,
    spacing: 1.2,
    customCss: '',
    document: {
      rows: [
        {
          id: 'r1',
          columns: [
            {
              id: 'c1',
              span: 12,
              blocks: [
                {
                  id: 'b1',
                  type: 'html' as const,
                  visible: true,
                  content: '<div onclick="x()">{{{a}}}</div>',
                },
              ],
            },
          ],
        },
      ],
    },
  };
  if (templateConfigSchema.safeParse(badHtml).success) {
    errors.push('dangerous html should fail');
  }

  return errors;
}
