// ==UserScript==
// @name         5ch donguri rename assist LOCAL
// @namespace    local.fixed.donguri.rename.assist
// @version      1.0.0-local
// @description  どんぐりネームをコードポイントで入力できるツール
// @license      MIT
// @author       81f32c5c
// @copyright    2026 81f32c5c
// @match        https://donguri.5ch.io/rename
// @grant        none
// ==/UserScript==

(() => {
  document.head.appendChild(document.createElement('style')).textContent = `
    .conv {
      text-align: left;
      margin-bottom: 1lh;
    }
    #input {
      margin: 0;
      width: 100%;
    }
    #transcription {
      margin: 0;
    }
  `;
  const tag_style_output = document.head.appendChild(document.createElement('style'));
  tag_style_output.textContent = `
    .output {
      outline: 1px solid #000;
    }
  `;

  const SAMPLE1 = 'ゼロ#{200b}幅';
  const SAMPLE2 = '半#{20}角';
  const SAMPLE3 = '全#{3000}角';
  const SAMPLE4 = '家族#{1f468}#{200d}#{1f469}#{200d}#{1f467}#{200d}#{1f466}';
  const tag_root = document.querySelector('body > p');
  tag_root.innerHTML = `
    <div class="conv">
      <div>どんぐりネームをコードポイントで入力できるツール</div>
      <div><input id="input" type="text"></div>
      <div>表示例: <span id="output" class="output"></span></div>
      <div>長さ: CodePoint数→<span id="length_cp"></span>/20</div>
      <div><input id="transcription" type="button" value="転記"></div>
      <div><label><input id="outline" type="checkbox" checked>表示例のアウトライン表示</label></div>
      <div>入力例1: ##→<span class="output">#</span>、${SAMPLE1}→<span class="output">${replace(SAMPLE1)}</span>、${SAMPLE2}→<span class="output">${replace(SAMPLE2)}</span>、${SAMPLE3}→<span class="output">${replace(SAMPLE3)}</span></div>
      <div>入力例2: ${SAMPLE4}→<span class="output">${replace(SAMPLE4)}</span></div>
    </div>
  `;

  const tag_input = document.querySelector('#input');
  const tag_output = document.querySelector('#output');
  const tag_length_cp = document.querySelector('#length_cp');
  const tag_transcription = document.querySelector('#transcription');
  const tag_outline = document.querySelector('#outline');
  const tag_name = document.querySelector('#name');

  function replace(input) {
    return input.replace(/#(?:#|\{([0-9a-fA-F]+)\})/g, (match, p1) => {
      if (match === '##') return '#';
      const number = parseInt(p1, 16);
      if (number >= 0 && number <= 0x10ffff) return String.fromCodePoint(number);
      return match;
    });
  }
  function onInput() {
    const output = replace(tag_input.value);
    tag_output.textContent = output;
    tag_length_cp.textContent = [...output].length;
  }
  function onClick() {
    tag_name.value = tag_output.textContent;
  }
  function onChange() {
    if (tag_outline.checked) {
      document.head.appendChild(tag_style_output);
    } else {
      tag_style_output.remove();
    }
  }

  tag_input.addEventListener('input', onInput);
  tag_transcription.addEventListener('click', onClick);
  tag_outline.addEventListener('change', onChange);

  onInput();
  onChange();
})();
