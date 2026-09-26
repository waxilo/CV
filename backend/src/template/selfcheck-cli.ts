import { runTemplateSchemaSelfCheck } from './selfcheck';

const errors = runTemplateSchemaSelfCheck();
if (errors.length) {
  console.error('模板 schema 自检失败：');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('模板 schema 自检通过');
