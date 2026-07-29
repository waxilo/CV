/**
 * @cv/template-schema
 *
 * 模板配置的类型、限额、安全规则、校验与迁移。
 * 前端（渲染 + 设计器）与后端（Workers 校验）共用这一份实现。
 */

export * from './limits';
export * from './types';
export * from './safety';
export * from './validate';
export * from './migrate';
export * from './builtin';
