-- 模板引擎 v2
--
-- 1. 给 template 表补 engine / schema_version 冗余列，便于按引擎筛选与定位老数据
-- 2. 移除 3 个内置模板的 seed 行
--
-- 内置模板从此由代码提供（shared/template-schema/src/builtin），不再入库。
-- 理由：内置模板本质是代码的一部分（HTML + CSS + 变量声明），随版本演进；
-- 塞进 SQL 会让每次改内置模板都要写一条几 KB 的 migration，且无法被类型检查覆盖。
-- 用户 clone 出来的副本是独立行（is_builtin = 0），不受这里的 DELETE 影响。

ALTER TABLE template ADD COLUMN engine TEXT NOT NULL DEFAULT 'blocks';
ALTER TABLE template ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_template_engine ON template(engine);

-- 已有的用户自定义模板都是 v1 区块 DSL，读取时由 normalizeTemplateConfig 升级到 v2，
-- 这里把冗余列同步为实际值，避免筛选时漏掉它们。
UPDATE template SET engine = 'blocks', schema_version = 1 WHERE is_builtin = 0;

DELETE FROM template WHERE is_builtin = 1 AND id IN ('modern', 'classic', 'minimal');
