/**
 * 共享模板 schema 的唯一入口（后端侧）
 *
 * 这里刻意使用相对路径而不是 tsconfig paths 别名：镜像里的 esbuild 只认
 * tsconfig 的 include，paths 别名还要额外配 resolver，相对路径一定解析得到。整个后端只有这一处丑路径，
 * 其余模块统一从 './shared' 引入。
 */
export * from '../../../shared/template-schema/src/index';
