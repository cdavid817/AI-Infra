import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVisualManifest } from '../validate-visuals.mjs';

const figure = {
  id: 'ch01-test', chapter: 1, title: '测试', type: 'comparison', purpose: 'comparison',
  source_kind: 'generated', source_file: 'source.js', output_file: 'out.svg', data_files: ['data.csv'],
  license: 'CC-BY-4.0', alt: '两组数据对照', caption: '右侧更高。', status: 'published',
};

test('视觉 manifest 与 BookFigure 引用一致时通过', () => {
  const text = '<BookFigure id="ch01-test" src="../visuals/out.svg" alt="两组数据对照" caption="右侧更高。" />';
  assert.deepEqual(validateVisualManifest({ version: 1, figures: [figure] }, { fileExists: () => true, chapterTexts: [{ file: 'ch01.md', text }] }), []);
});

test('缺文件和未登记 BookFigure 被检出', () => {
  const diagnostics = validateVisualManifest({ version: 1, figures: [figure] }, { fileExists: () => false, chapterTexts: [{ file: 'ch01.md', text: '<BookFigure id="unknown" src="x.svg" alt="a" caption="c" />' }] });
  assert.ok(diagnostics.some((d) => d.message.includes('文件不存在')));
  assert.ok(diagnostics.some((d) => d.message.includes('未登记')));
});
