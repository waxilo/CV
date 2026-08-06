/**
 * 内置 v2 HTML 模板
 *
 * 内置模板同时承担三个职责：
 *   1. D1 seed 数据（migration 0002 起改为代码内置，不入库）
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
  font-family: var(--tpl-font-family), 'Microsoft YaHei', sans-serif;
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

.side-sec { margin-bottom: 20px; }
.side-sec h2 {
  font-size: 0.95em; margin: 0 0 10px; padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.35);
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
  break-after: avoid;
  page-break-after: avoid;
}
.side-item { margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
.side-item-row { display: flex; justify-content: space-between; gap: 8px; font-size: 0.9em; }
.side-item-row em { font-style: normal; opacity: 0.7; }
.side-desc { margin-top: 5px; font-size: 0.82em; opacity: 0.9; white-space: pre-wrap; }
.bar { height: 5px; margin-top: 5px; background: rgba(255, 255, 255, 0.25); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: #fff; }

.sec { margin-bottom: var(--tpl-section-gap); }
.sec-title {
  font-size: 1.05em; margin: 0 0 12px; padding-bottom: 5px;
  color: var(--tpl-primary-color);
  border-bottom: 2px solid var(--tpl-primary-color);
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
  break-after: avoid;
  page-break-after: avoid;
}
.item { margin-bottom: 13px; break-inside: avoid; page-break-inside: avoid; }
.item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.item-head strong { font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif; }
.date { flex-shrink: 0; font-size: 0.85em; color: var(--tpl-muted-color); white-space: nowrap; }
.sub { margin-top: 2px; font-size: 0.92em; color: var(--tpl-muted-color); }
.rich { margin-top: 5px; }
.rich p { margin: 0 0 0.35em; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.2em 0 0.35em; padding-left: 1.35em; }
.rich li { margin: 0.2em 0; }
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
  font-family: var(--tpl-font-family), 'Songti SC', 'SimSun', serif;
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

.sec { margin-top: var(--tpl-section-gap); }
.sec-title {
  font-size: 1em; margin: 0 0 10px; padding-bottom: 3px;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--tpl-primary-color);
  border-bottom: 1px solid #cbd5e1;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), serif;
  break-after: avoid;
  page-break-after: avoid;
}

.item { margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
.item-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.item-head strong { font-family: var(--tpl-heading-font-family), var(--tpl-font-family), serif; }
.date { flex-shrink: 0; font-size: 0.85em; color: var(--tpl-muted-color); white-space: nowrap; }
.sub { margin-top: 2px; font-size: 0.92em; color: var(--tpl-muted-color); }
.sub em { font-style: italic; }
.rich { margin-top: 4px; text-align: justify; }
.rich p { margin: 0 0 0.35em; text-align: justify; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.2em 0 0.35em; padding-left: 1.35em; }
.rich li { margin: 0.2em 0; }
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
  font-family: var(--tpl-font-family), 'Microsoft YaHei', sans-serif;
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

.sec { display: flex; gap: 20px; margin-bottom: var(--tpl-section-gap); }
.sec-title {
  width: 92px; flex-shrink: 0; margin: 0;
  font-size: 0.78em; font-weight: 500; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--tpl-primary-color); padding-top: 3px;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
  break-after: avoid;
  page-break-after: avoid;
}
.sec-body { flex: 1; min-width: 0; }

.item { display: flex; gap: 16px; margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
.item-main { flex: 1; min-width: 0; }
.item-main strong {
  font-weight: 500;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
}
.sub { display: block; margin-top: 1px; font-size: 0.9em; color: var(--tpl-muted-color); }
.date { flex-shrink: 0; font-size: 0.8em; color: var(--tpl-muted-color); white-space: nowrap; padding-top: 2px; }
.rich { margin-top: 5px; font-size: 0.95em; }
.rich p { margin: 0 0 0.35em; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol { margin: 0.2em 0 0.35em; padding-left: 1.35em; }
.rich li { margin: 0.2em 0; }
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
  font-family: var(--tpl-heading-font-family), 'Microsoft YaHei', sans-serif;
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
  font-family: var(--tpl-heading-font-family), 'Microsoft YaHei', sans-serif;
  font-size: 1.16em;
  font-weight: 700;
  line-height: 1.25;
  color: var(--tpl-text-color);
  break-after: avoid;
  page-break-after: avoid;
}
.item,
.skill-item {
  margin: 0 0 11px;
  break-inside: avoid;
  page-break-inside: avoid;
}
.item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 7px;
}
.item-head strong {
  font-family: var(--tpl-heading-font-family), 'Microsoft YaHei', sans-serif;
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
.rich p { margin: 0 0 0.35em; text-align: justify; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol {
  margin: 0.2em 0 0.35em;
  padding-left: 1.35em;
}
.rich li { margin: 0.2em 0; }
.rich a { color: inherit; text-decoration: underline; }
.summary {
  margin-top: 0;
}
.skill-item h3 {
  margin: 0 0 5px;
  font-family: var(--tpl-heading-font-family), 'Microsoft YaHei', sans-serif;
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
 * 酒红商务：无头像信息栏 + 三角箭头分节
 * ============================================================ */

const BUSINESS_HTML = `
<article class="cv">
  <header class="head">
    <div class="head-left">
      <h1 class="name">{{basics.name | default('你的姓名')}}</h1>
      {{#if basics.headline}}
        <p class="intent">求职意向 · {{basics.headline}}</p>
      {{/if}}
    </div>
    <ul class="head-right">
      {{#if basics.phone}}
        <li><em>电话</em><span>{{basics.phone}}</span></li>
      {{/if}}
      {{#if basics.email}}
        <li><em>邮箱</em><span>{{basics.email}}</span></li>
      {{/if}}
      {{#if basics.location}}
        <li><em>所在地</em><span>{{basics.location}}</span></li>
      {{/if}}
      {{#if basics.wechat}}
        <li><em>微信</em><span>{{basics.wechat}}</span></li>
      {{/if}}
      {{#if basics.url}}
        <li><em>主页</em><span>{{basics.url}}</span></li>
      {{/if}}
    </ul>
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
            <div class="item skill-item">
              <div class="skill-head">
                <strong class="item-primary">{{this.title}}</strong>
                {{#if this.keywords}}
                  <span class="skill-keywords">：{{#each this.keywords}}{{#unless @first}}、{{/unless}}{{this}}{{/each}}</span>
                {{/if}}
              </div>
              {{#if this.descriptionSafe}}
                <div class="rich">{{& this.descriptionSafe}}</div>
              {{/if}}
            </div>
          {{/each}}
        {{else}}
          {{#if this.type | eq('languages')}}
            {{#each this.items}}
              <div class="item skill-item">
                <div class="skill-head">
                  <strong class="item-primary">{{this.title}}</strong>
                  {{#if this.subtitle}}<span class="skill-keywords">：{{this.subtitle}}</span>{{/if}}
                </div>
              </div>
            {{/each}}
          {{else}}
            {{#if this.type | eq('experience')}}
              {{#each this.items}}
                <div class="item">
                  <div class="item-row">
                    <strong class="item-primary">{{this.raw.company}}</strong>
                    {{#if this.dateRange}}<span class="date">{{this.dateRange}}</span>{{/if}}
                  </div>
                  {{#if this.raw.position}}
                    <div class="item-row item-row--sub">
                      <span class="item-secondary">{{this.raw.position}}</span>
                      {{#if this.meta}}<span class="loc">{{this.meta}}</span>{{/if}}
                    </div>
                  {{/if}}
                  {{#if this.descriptionSafe}}<div class="rich">{{& this.descriptionSafe}}</div>{{/if}}
                </div>
              {{/each}}
            {{else}}
              {{#each this.items}}
                <div class="item">
                  <div class="item-row">
                    <strong class="item-primary">{{this.title}}</strong>
                    {{#if this.dateRange}}<span class="date">{{this.dateRange}}</span>{{/if}}
                  </div>
                  {{#if this.subtitle}}
                    <div class="item-row item-row--sub">
                      <span class="item-secondary">{{this.subtitle}}</span>
                      {{#if this.raw.location}}<span class="loc">{{this.raw.location}}</span>{{/if}}
                    </div>
                  {{else}}
                    {{#if this.raw.location}}
                      <div class="item-row item-row--sub">
                        <span class="item-secondary"></span>
                        <span class="loc">{{this.raw.location}}</span>
                      </div>
                    {{/if}}
                  {{/if}}
                  {{#if this.descriptionSafe}}<div class="rich">{{& this.descriptionSafe}}</div>{{/if}}
                  {{#if this.keywords}}
                    <div class="tags">{{#each this.keywords}}<span>{{this}}</span>{{/each}}</div>
                  {{/if}}
                </div>
              {{/each}}
            {{/if}}
          {{/if}}
        {{/if}}
      </section>
    {{/unless}}
  {{/each}}
</article>
`;

const BUSINESS_CSS = `
.cv {
  padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
  font-family: var(--tpl-font-family), 'Microsoft YaHei', sans-serif;
  font-size: var(--tpl-font-size);
  line-height: var(--tpl-line-height);
  color: var(--tpl-text-color);
  background: #fff;
}

/* —— 页眉：左姓名意向 / 右联系方式，酒红底边 —— */
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px 28px;
  margin: 0 0 20px;
  padding: 0 0 14px;
  border-bottom: 2px solid var(--tpl-primary-color);
}
.head-left {
  flex: 1;
  min-width: 0;
}
.name {
  margin: 0;
  padding: 0;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
  font-size: 1.7em;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.06em;
  color: var(--tpl-text-color);
}
.intent {
  margin: 6px 0 0;
  font-size: 0.9em;
  font-weight: 400;
  line-height: 1.45;
  color: var(--tpl-muted-color);
  word-break: break-word;
}
.head-right {
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: right;
}
.head-right li {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  line-height: 1.55;
  font-size: 0.9em;
}
.head-right li + li {
  margin-top: 2px;
}
.head-right em {
  flex-shrink: 0;
  font-style: normal;
  font-weight: 400;
  color: var(--tpl-muted-color);
}
.head-right span {
  font-weight: 600;
  color: var(--tpl-text-color);
  word-break: break-all;
}

/* —— 分节：三角箭头 + 延伸横线 —— */
.sec {
  margin: 0 0 var(--tpl-section-gap);
}
.sec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
  font-size: 1.08em;
  font-weight: 700;
  line-height: 1.25;
  color: var(--tpl-primary-color);
  break-after: avoid;
  page-break-after: avoid;
}
.sec-title::before {
  content: '';
  flex-shrink: 0;
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid var(--tpl-primary-color);
}
.sec-title::after {
  content: '';
  flex: 1;
  min-width: 12px;
  height: 1px;
  background: var(--tpl-primary-color);
  margin-left: 2px;
}

/* —— 条目：主标题/日期同行，副标题/地点同行 —— */
.item {
  margin: 0 0 14px;
  break-inside: avoid;
  page-break-inside: avoid;
}
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.item-row--sub {
  margin-top: 2px;
}
.item-primary {
  font-family: var(--tpl-heading-font-family), var(--tpl-font-family), sans-serif;
  font-size: 1em;
  font-weight: 700;
  color: var(--tpl-text-color);
}
.item-secondary {
  font-size: 0.92em;
  color: var(--tpl-text-color);
}
.date,
.loc {
  flex-shrink: 0;
  font-size: 0.88em;
  color: var(--tpl-muted-color);
  white-space: nowrap;
}

.rich {
  margin-top: 5px;
}
.rich p { margin: 0 0 0.3em; }
.rich p:last-child { margin-bottom: 0; }
.rich ul, .rich ol {
  margin: 0.15em 0 0.3em;
  padding-left: 1.25em;
}
.rich li { margin: 0.18em 0; }
.rich a { color: inherit; text-decoration: underline; }
.summary { margin-top: 0; }

/* 技能/语言：标题独立成行，不进列表序号；描述里的列表才带圆点 */
.sec--skills .skill-item,
.sec--languages .skill-item {
  margin: 0 0 8px;
}
.skill-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0;
}
.skill-keywords {
  font-weight: 400;
  color: var(--tpl-text-color);
}
.sec--skills .skill-item .rich {
  margin-top: 2px;
}
.sec--skills .skill-item .rich ul,
.sec--skills .skill-item .rich ol {
  margin-top: 0.1em;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}
.tags span {
  font-size: 0.82em;
  color: var(--tpl-muted-color);
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
      fontFamily: 'Microsoft YaHei',
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
      fontFamily: 'Songti SC, SimSun',
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
      fontFamily: 'Microsoft YaHei',
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
        headingFontFamily: 'Microsoft YaHei',
      },
    }),
  },
  {
    id: 'business',
    name: '酒红商务',
    description: '左右分栏基础信息 + 三角箭头分节，适合传统行业',
    config: build({
      title: '酒红商务',
      layout: 'single-column',
      primaryColor: '#A83C4E',
      fontFamily: 'Microsoft YaHei',
      fontSize: 13,
      spacing: 1.45,
      html: BUSINESS_HTML,
      css: BUSINESS_CSS,
      tags: ['单栏', '商务', '酒红'],
      variableOverrides: {
        sectionGap: '20px',
        textColor: '#1a1a1a',
        mutedColor: '#6b6b6b',
        showAvatar: false,
        dateFormat: 'YYYY年MM月',
        headingFontFamily: 'Microsoft YaHei',
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
