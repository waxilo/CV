/**
 * 受限 Mustache（兼容层）
 *
 * 实现已被 template-lang 的 AST 引擎取代。保留这个入口是因为历史上保存的
 * html 区块用的是 Mustache 原生语义（{{#items}} 对数组迭代、对对象切换作用域），
 * 新引擎完整支持这套写法，因此直接转调即可。
 *
 * 新模板请使用显式语法：{{#each}} / {{#if}} / {{#with}}。
 */

import { renderTemplateSource } from './template-lang';

/**
 * 渲染受限 Mustache 模板。
 *
 * @throws TemplateSyntaxError 遇到 {{{ }}} 或语法错误
 */
export function renderMustache(template: string, data: Record<string, unknown>): string {
  return renderTemplateSource(template, data);
}
