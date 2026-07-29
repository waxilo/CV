/**
 * 共享模板 schema 的唯一入口（后端侧）
 *
 * 这里刻意使用相对路径而不是 tsconfig paths 别名：wrangler 的 esbuild 打包
 * 对 paths 的支持不稳定，相对路径可以确定被解析。整个后端只有这一处丑路径，
 * 其余模块统一从 './shared' 引入。
 */
export * from '../../../shared/template-schema/src/index';
