/**
 * 内置 v2 HTML 模板
 *
 * 这三份模板同时承担三个职责：
 *   1. D1 seed 数据（migration 0002）
 *   2. 「新建模板」的预设起点
 *   3. 模板语法的参考实现
 */

import { CONTEXT_VERSION } from '../limits';
import {
  createBaseVariables,
  createDefaultCapabilities,
  createDefaultPage,
  createDocumentFromLayout,
  createSequentialIds,
} from '../migrate';
import type { ITemplateConfigV2, ITemplateVariable, TTemplateLayout } from '../types';

export interface IBuiltinTemplate {
  id: string;
  name: string;
  description: string;
  config: ITemplateConfigV2;
}

interface IBuildOptions {
  title: string;
  layout: TTemplateLayout;
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
  html: string;
  css: string;
  extraVariables?: ITemplateVariable[];
  variableOverrides?: Record<string, string | number | boolean>;
  tags?: string[];
}

function build(options: IBuildOptions): ITemplateConfigV2 {
  const base = createBaseVariables({
    primaryColor: options.primaryColor,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    spacing: options.spacing,
  });

  const overrides = options.variableOverrides || {};
  const variables = base
    .map((v) => (v.key in overrides ? { ...v, default: overrides[v.key] } : v))
    .concat(options.extraVariables || []);

  /*
   * 用确定性 id 而不是 uid()：这些模板在模块顶层构造，
   * Cloudflare Workers 不允许在全局作用域调用 crypto.randomUUID()。
   * engine=html 时 document 只是 v1 兼容字段的填充，id 不需要全局唯一。
   */
  const nextId = createSequentialIds(`builtin-${options.layout}`);

  return {
    schemaVersion: 2,
    engine: 'html',
    meta: {
      title: options.title,
      author: 'CV Builder',
      description: options.title,
      tags: options.tags || [],
      contextVersion: CONTEXT_VERSION,
    },
    page: createDefaultPage({ format: 'a4', paged: true }),
    variables,
    source: { html: options.html.trim(), css: options.css.trim() },
    capabilities: createDefaultCapabilities({ allowRemoteImages: true }),
    layout: options.layout,
    primaryColor: options.primaryColor,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    spacing: options.spacing,
    customCss: '',
    document: createDocumentFromLayout(options.layout, nextId),
  };
}

/* ============================================================
 * 现代简约：左侧强调色栏
 * ============================================================ */

const MODERN_HTML = `
<article class="cv">
  <aside class="side">
    {{#if vars.showAvatar}}
      {{#if basics.avatarUrl}}
        <img class="avatar" src="{{basics.avatarUrl}}" alt="" />
      {{else}}
        <div class="avatar avatar--ph">{{basics.initial}}</div>
      {{/if}}
    {{/if}}

    <h1 class="name">{{basics.name | default('你的姓名')}}</h1>
    <p class="headline">{{basics.headline}}</p>

    {{#if basics.contacts}}
      <ul class="contacts">
        {{#each basics.contacts}}
          <li><span class="c-label">{{this.label}}</span>{{this.value}}</li>
        {{/each}}
      </ul>
    {{/if}}

    {{#each sections | only('skills', 'languages', 'interests')}}
      {{#unless this.isEmpty}}
        <section class="side-sec">
          <h2>{{this.name}}</h2>
          {{#each this.items}}
            <div class="side-item">
              <div class="side-item-row">
                <span>{{this.title}}</span>
                {{#if this.subtitle}}<em>{{this.subtitle}}</em>{{/if}}
              </div>
              {{#if this.raw.level}}
                <div class="bar"><i style="width:{{this.raw.level | percent(5)}}"></i></div>
              {{/if}}
              {{#if this.descriptionSafe}}
                <div class="side-desc">{{& this.descriptionSafe}}</div>
              {{/if}}
              {{#if this.keywords}}
                <div class="tags">{{#each this.keywords}}<span>{{this}}</span>{{/each}}</div>
              {{/if}}
            </div>
          {{/each}}
        </section>
      {{/unless}}
    {{/each}}
  </aside>

  <main class="main">
    {{#each sections | exclude('skills', 'languages', 'interests')}}
      {{#unless this.isEmpty}}
        <section class="sec">
          <h2 class="sec-title">{{this.name}}</h2>

          {{#if this.isText}}
            <div class="rich">{{& this.contentSafe}}</div>
          {{/if}}

          {{#each this.items}}
            <div class="item">
              <div class="item-head">
                <strong>{{this.title}}</strong>
                {{#if this.dateRange}}<span class="date">{{this.dateRange}}</span>{{/if}}
              </div>
              {{#if this.subtitle}}
                <div class="sub">{{this.subtitle}}{{#if this.meta}} · {{this.meta}}{{/if}}</div>
              {{/if}}
              {{#if this.descriptionSafe}}
                <div class="rich">{{& this.descriptionSafe}}</div>
              {{/if}}
              {{#if this.keywords}}
                <div class="tags">{{#each this.keywords}}<span>{{this}}</span>{{/each}}</div>
              {{/if}}
            </div>
          {{/each}}
        </section>
      {{/unless}}
    {{/each}}
  </main>
</article>
`;

const MODERN_CSS = `
.cv {
  display: flex;
  align-items: stretch;
  min-height: 297mm;
  height: auto;
  font-family: var(--tpl-font-family), 'PingFang SC', sans-serif;
  font-size: var(--tpl-font-size);
  line-height: var(--tpl-line-height);
  color: var(--tpl-text-color);
}

.side {
  width: 33%;
  flex-shrink: 0;
  padding: var(--page-margin-top) 18px var(--page-margin-bottom) var(--page-margin-left);
  background: var(--tpl-primary-color);
  color: #fff;
}
.main {
  flex: 1;
  min-width: 0;
  padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) 20px;
}

.avatar {
  width: 76px; height: 76px; border-radius: 50%;
  object-fit: cover; margin-bottom: 14px;
  background: rgba(255, 255, 255, 0.18);
}
.avatar--ph {
  display: grid; place-items: center;
  font-size: 30px; font-weight: 700;
}

.name { margin: 0 0 4px; font-size: 1.55em; line-height: 1.2; font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif; }
.headline { margin: 0 0 18px; opacity: 0.85; font-size: 0.95em; }

.contacts { list-style: none; margin: 0 0 22px; padding: 0; font-size: 0.85em; }
.contacts li { display: flex; flex-direction: column; gap: 1px; margin-bottom: 8px; word-break: break-all; }
.c-label { opacity: 0.65; font-size: 0.85em; }

.side-sec { margin-bottom: 20px; break-inside: avoid; }
.side-sec h2 {
  font-size: 0.95em; margin: 0 0 10px; padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.35);
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
}
.side-item { margin-bottom: 10px; break-inside: avoid; }
.side-item-row { display: flex; justify-content: space-between; gap: 8px; font-size: 0.9em; }
.side-item-row em { font-style: normal; opacity: 0.7; }
.side-desc { margin-top: 5px; font-size: 0.82em; opacity: 0.9; white-space: pre-wrap; }
.bar { height: 5px; margin-top: 5px; background: rgba(255, 255, 255, 0.25); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: #fff; }

.sec { margin-bottom: var(--tpl-section-gap); break-inside: avoid; }
.sec-title {
  font-size: 1.05em; margin: 0 0 12px; padding-bottom: 5px;
  color: var(--tpl-primary-color);
  border-bottom: 2px solid var(--tpl-primary-color);
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
}
.item { margin-bottom: 13px; break-inside: avoid; }
.item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.item-head strong { font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif; }
.date { flex-shrink: 0; font-size: 0.85em; color: var(--tpl-muted-color); white-space: nowrap; }
.sub { margin-top: 2px; font-size: 0.92em; color: var(--tpl-muted-color); }
.rich { margin-top: 5px; }
.rich p { margin: 0 0 0.4em; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.3em 0; padding-left: 1.35em; }
.rich li { margin: 0.12em 0; }
.rich a { color: inherit; text-decoration: underline; }

.tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.main .tags span { background: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 4px; font-size: 0.82em; }
.side .tags span { background: rgba(255, 255, 255, 0.18); padding: 2px 7px; border-radius: 4px; font-size: 0.82em; }
`;

/* ============================================================
 * 经典正式：居中标题 + 分节横线
 * ============================================================ */

const CLASSIC_HTML = `
<article class="cv">
  <header class="head">
    <h1 class="name">{{basics.name | default('你的姓名')}}</h1>
    {{#if basics.headline}}<p class="headline">{{basics.headline}}</p>{{/if}}
    {{#if basics.contacts}}
      <p class="contacts">
        {{#each basics.contacts}}{{#unless @first}}<span class="sep">|</span>{{/unless}}{{this.value}}{{/each}}
      </p>
    {{/if}}
  </header>

  {{#each sections}}
    {{#unless this.isEmpty}}
      <section class="sec">
        <h2 class="sec-title">{{this.name}}</h2>

        {{#if this.isText}}
          <div class="rich">{{& this.contentSafe}}</div>
        {{/if}}

        {{#if this.type | eq('skills')}}
          {{#each this.items}}
            <div class="item">
              <div class="item-head">
                <strong>{{this.title}}</strong>
              </div>
              {{#if this.descriptionSafe}}
                <div class="rich">{{& this.descriptionSafe}}</div>
              {{/if}}
              {{#if this.keywords}}
                <div class="tags">{{#each this.keywords}}<span>{{this}}</span>{{/each}}</div>
              {{/if}}
            </div>
          {{/each}}
        {{else}}
          {{#each this.items}}
            <div class="item">
              <div class="item-head">
                <strong>{{this.title}}</strong>
                {{#if this.dateRange}}<span class="date">{{this.dateRange}}</span>{{/if}}
              </div>
              {{#if this.subtitle}}
                <div class="sub"><em>{{this.subtitle}}</em>{{#if this.meta}} · {{this.meta}}{{/if}}</div>
              {{/if}}
              {{#if this.descriptionSafe}}<div class="rich">{{& this.descriptionSafe}}</div>{{/if}}
              {{#if this.keywords}}
                <div class="tags">{{#each this.keywords}}<span>{{this}}</span>{{/each}}</div>
              {{/if}}
            </div>
          {{/each}}
        {{/if}}
      </section>
    {{/unless}}
  {{/each}}
</article>
`;

const CLASSIC_CSS = `
.cv {
  padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
  font-family: var(--tpl-font-family), 'Songti SC', serif;
  font-size: var(--tpl-font-size);
  line-height: var(--tpl-line-height);
  color: var(--tpl-text-color);
}

.head { text-align: center; padding-bottom: 14px; border-bottom: 3px double var(--tpl-primary-color); }
.name {
  margin: 0; font-size: 1.9em; letter-spacing: 0.08em; color: var(--tpl-primary-color);
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), serif;
}
.headline { margin: 6px 0 0; font-size: 1em; color: var(--tpl-muted-color); }
.contacts { margin: 10px 0 0; font-size: 0.85em; color: var(--tpl-muted-color); }
.sep { margin: 0 7px; opacity: 0.5; }

.sec { margin-top: var(--tpl-section-gap); break-inside: avoid; }
.sec-title {
  font-size: 1em; margin: 0 0 10px; padding-bottom: 3px;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--tpl-primary-color);
  border-bottom: 1px solid #cbd5e1;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), serif;
}

.item { margin-bottom: 12px; break-inside: avoid; }
.item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.item-head strong { font-family: var(--tpl-heading-font-family), var(--tpl-font-family), serif; }
.date { flex-shrink: 0; font-size: 0.85em; color: var(--tpl-muted-color); white-space: nowrap; }
.sub { margin-top: 2px; font-size: 0.92em; color: var(--tpl-muted-color); }
.sub em { font-style: italic; }
.rich { margin-top: 4px; text-align: justify; }
.rich p { margin: 0 0 0.4em; text-align: justify; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.3em 0; padding-left: 1.35em; }
.rich li { margin: 0.12em 0; }
.rich a { color: inherit; text-decoration: underline; }
.skill-line { margin: 0; }

.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.tags span { border: 1px solid #cbd5e1; padding: 1px 7px; border-radius: 3px; font-size: 0.82em; }
`;

/* ============================================================
 * 极简白：大量留白
 * ============================================================ */

const MINIMAL_HTML = `
<article class="cv">
  <header class="head">
    <h1 class="name">{{basics.name | default('你的姓名')}}</h1>
    {{#if basics.headline}}<p class="headline">{{basics.headline}}</p>{{/if}}
    {{#if basics.contacts}}
      <ul class="contacts">
        {{#each basics.contacts}}<li>{{this.value}}</li>{{/each}}
      </ul>
    {{/if}}
  </header>

  {{#each sections}}
    {{#unless this.isEmpty}}
      <section class="sec">
        <h2 class="sec-title">{{this.name}}</h2>
        <div class="sec-body">
          {{#if this.isText}}
            <div class="rich">{{& this.contentSafe}}</div>
          {{/if}}

          {{#each this.items}}
            <div class="item">
              <div class="item-main">
                <strong>{{this.title}}</strong>
                {{#if this.subtitle}}<span class="sub">{{this.subtitle}}</span>{{/if}}
                {{#if this.descriptionSafe}}<div class="rich">{{& this.descriptionSafe}}</div>{{/if}}
                {{#if this.keywords}}
                  <div class="tags">{{#each this.keywords}}<span>{{this}}</span>{{/each}}</div>
                {{/if}}
              </div>
              {{#if this.dateRange}}<div class="date">{{this.dateRange}}</div>{{/if}}
            </div>
          {{/each}}
        </div>
      </section>
    {{/unless}}
  {{/each}}
</article>
`;

const MINIMAL_CSS = `
.cv {
  padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
  font-family: var(--tpl-font-family), 'PingFang SC', sans-serif;
  font-size: var(--tpl-font-size);
  line-height: var(--tpl-line-height);
  color: var(--tpl-text-color);
}

.head { margin-bottom: 34px; }
.name {
  margin: 0; font-size: 2.1em; font-weight: 300; letter-spacing: 0.04em;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
}
.headline { margin: 4px 0 0; color: var(--tpl-muted-color); font-weight: 300; }
.contacts {
  list-style: none; display: flex; flex-wrap: wrap; gap: 16px;
  margin: 14px 0 0; padding: 0; font-size: 0.85em; color: var(--tpl-muted-color);
}

.sec { display: flex; gap: 20px; margin-bottom: var(--tpl-section-gap); break-inside: avoid; }
.sec-title {
  width: 92px; flex-shrink: 0; margin: 0;
  font-size: 0.78em; font-weight: 500; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--tpl-primary-color); padding-top: 3px;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
}
.sec-body { flex: 1; min-width: 0; }

.item { display: flex; gap: 16px; margin-bottom: 16px; break-inside: avoid; }
.item-main { flex: 1; min-width: 0; }
.item-main strong {
  font-weight: 500;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
}
.sub { display: block; margin-top: 1px; font-size: 0.9em; color: var(--tpl-muted-color); }
.date { flex-shrink: 0; font-size: 0.8em; color: var(--tpl-muted-color); white-space: nowrap; padding-top: 2px; }
.rich { margin-top: 5px; font-size: 0.95em; }
.rich p { margin: 0 0 0.4em; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.3em 0; padding-left: 1.35em; }
.rich li { margin: 0.12em 0; }
.rich a { color: inherit; text-decoration: underline; }

.tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 0.85em; color: var(--tpl-muted-color); }
`;

/* ============================================================
 * Word 极简：仿 Word 默认简历的紧凑黑白排版
 * ============================================================ */

const TECHNICAL_HTML = `
<article class="cv">
  <header class="head">
    <h1 class="name">{{basics.name | default('你的姓名')}}</h1>
    {{#if basics.demographics}}
      <p class="profile">{{basics.demographics}}</p>
    {{/if}}
    {{#if basics.headline}}<p class="headline">{{basics.headline}}</p>{{/if}}
    {{#if basics.contacts}}
      <p class="contacts">
        {{#each basics.contacts}}
          {{#unless @first}}<span class="sep">|</span>{{/unless}}
          <span class="contact">{{this.label}}：{{this.value}}</span>
        {{/each}}
      </p>
    {{/if}}
  </header>

  {{#each sections}}
    {{#unless this.isEmpty}}
      <section class="sec sec--{{this.type}}">
        <h2 class="sec-title">{{this.name}}</h2>

        {{#if this.isText}}
          <div class="rich summary">{{& this.contentSafe}}</div>
        {{/if}}

        {{#if this.type | eq('skills')}}
          {{#each this.items}}
            <div class="skill-item">
              <h3>{{this.title}}</h3>
              {{#if this.descriptionSafe}}
                <div class="rich">{{& this.descriptionSafe}}</div>
              {{else}}
                {{#if this.keywords}}
                  <p>{{#each this.keywords}}{{#unless @first}}、{{/unless}}{{this}}{{/each}}</p>
                {{/if}}
              {{/if}}
            </div>
          {{/each}}
        {{else}}
          {{#if this.type | eq('experience')}}
            {{#each this.items}}
              <div class="item">
                <div class="item-head">
                  <strong>{{this.raw.company}}</strong>
                  {{#if this.dateRange}}<span class="date">（{{this.dateRange}}）</span>{{/if}}
                </div>
                {{#if this.raw.position}}
                  <div class="sub">{{this.raw.position}}{{#if this.meta}} · {{this.meta}}{{/if}}</div>
                {{/if}}
                {{#if this.descriptionSafe}}<div class="rich">{{& this.descriptionSafe}}</div>{{/if}}
              </div>
            {{/each}}
          {{else}}
            {{#each this.items}}
              <div class="item">
                <div class="item-head">
                  <strong>{{this.title}}</strong>
                  {{#if this.dateRange}}<span class="date">（{{this.dateRange}}）</span>{{/if}}
                </div>
                {{#if this.subtitle}}
                  <div class="sub">{{this.subtitle}}{{#if this.meta}} · {{this.meta}}{{/if}}</div>
                {{/if}}
                {{#if this.descriptionSafe}}<div class="rich">{{& this.descriptionSafe}}</div>{{/if}}
                {{#if this.keywords}}
                  <p class="keyword-line">{{#each this.keywords}}{{#unless @first}}、{{/unless}}{{this}}{{/each}}</p>
                {{/if}}
              </div>
            {{/each}}
          {{/if}}
        {{/if}}
      </section>
    {{/unless}}
  {{/each}}
</article>
`;

const TECHNICAL_CSS = `
.cv {
  padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
  font-family: var(--tpl-font-family), 'Songti SC', 'SimSun', serif;
  font-size: var(--tpl-font-size);
  line-height: var(--tpl-line-height);
  color: var(--tpl-text-color);
  background: var(--tpl-background-color);
}

.head {
  margin-bottom: 17px;
}
.name {
  margin: 0 0 10px;
  font-family: var(--tpl-heading-font-family), 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 1.42em;
  font-weight: 700;
  line-height: 1.2;
}
.profile {
  margin: 0 0 8px;
  font-weight: 700;
}
.headline {
  margin: 0 0 8px;
  font-weight: 700;
}
.contacts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 7px;
  margin: 0;
  font-size: 0.88em;
}
.sep {
  color: #777;
}

.sec {
  margin: 0 0 var(--tpl-section-gap);
}
.sec-title {
  margin: 0 0 10px;
  font-family: var(--tpl-heading-font-family), 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 1.16em;
  font-weight: 700;
  line-height: 1.25;
  color: var(--tpl-text-color);
}
.item,
.skill-item {
  margin: 0 0 11px;
  break-inside: avoid;
}
.item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 7px;
}
.item-head strong {
  font-family: var(--tpl-heading-font-family), 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 1em;
  font-weight: 700;
}
.date {
  font-size: 0.9em;
  white-space: nowrap;
}
.sub {
  margin-top: 3px;
  font-weight: 700;
}
.rich {
  margin-top: 4px;
  text-align: justify;
}
.rich p { margin: 0 0 0.4em; text-align: justify; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.3em 0; padding-left: 1.35em; }
.rich li { margin: 0.12em 0; }
.rich a { color: inherit; text-decoration: underline; }
.summary {
  margin-top: 0;
}
.skill-item h3 {
  margin: 0 0 5px;
  font-family: var(--tpl-heading-font-family), 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 0.98em;
  font-weight: 700;
}
.skill-item p,
.keyword-line {
  margin: 0;
  text-align: justify;
}

.sec--skills .skill-item {
  padding-left: 0;
}
`;

/* ============================================================
 * 导出
 * ============================================================ */

export const BUILTIN_TEMPLATES: IBuiltinTemplate[] = [
  {
    id: 'modern',
    name: '现代简约',
    description: '左侧强调色栏 + 右侧内容，适合互联网岗位',
    config: build({
      title: '现代简约',
      layout: 'sidebar-left',
      primaryColor: '#2563eb',
      fontFamily: 'Inter',
      fontSize: 14,
      spacing: 1.15,
      html: MODERN_HTML,
      css: MODERN_CSS,
      tags: ['双栏', '互联网'],
      variableOverrides: { showAvatar: true, sectionGap: '20px' },
    }),
  },
  {
    id: 'classic',
    name: '经典正式',
    description: '居中标题 + 分节横线，适合传统行业',
    config: build({
      title: '经典正式',
      layout: 'single-column',
      primaryColor: '#1e293b',
      fontFamily: 'Georgia',
      fontSize: 14,
      spacing: 1.2,
      html: CLASSIC_HTML,
      css: CLASSIC_CSS,
      tags: ['单栏', '正式'],
      variableOverrides: { sectionGap: '20px' },
    }),
  },
  {
    id: 'minimal',
    name: '极简白',
    description: '大量留白、轻量排版，适合设计/产品岗',
    config: build({
      title: '极简白',
      layout: 'single-column',
      primaryColor: '#0f172a',
      fontFamily: 'Helvetica',
      fontSize: 13,
      spacing: 1.3,
      html: MINIMAL_HTML,
      css: MINIMAL_CSS,
      tags: ['单栏', '极简'],
      variableOverrides: { sectionGap: '26px', mutedColor: '#94a3b8' },
    }),
  },
  {
    id: 'technical',
    name: 'Word 极简',
    description: '紧凑黑白单栏排版，接近 Word 默认简历观感',
    config: build({
      title: 'Word 极简',
      layout: 'single-column',
      primaryColor: '#111111',
      fontFamily: 'Songti SC, SimSun',
      fontSize: 12,
      spacing: 1.5,
      html: TECHNICAL_HTML,
      css: TECHNICAL_CSS,
      tags: ['单栏', '技术', '黑白', 'Word', '打印友好'],
      variableOverrides: {
        sectionGap: '18px',
        textColor: '#111111',
        mutedColor: '#555555',
        backgroundColor: '#ffffff',
        showAvatar: false,
        headingFontFamily: 'PingFang SC, Microsoft YaHei',
      },
    }),
  },
];

export function getBuiltinTemplate(id: string): IBuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

/** 新建 HTML 模板时的空白起点 */
export function createStarterHtmlConfig(): ITemplateConfigV2 {
  const minimal = BUILTIN_TEMPLATES[2];
  return {
    ...JSON.parse(JSON.stringify(minimal.config)),
    meta: {
      title: '我的模板',
      description: '',
      tags: [],
      contextVersion: CONTEXT_VERSION,
    },
  } as ITemplateConfigV2;
}
