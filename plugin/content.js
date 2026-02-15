chrome.runtime.onMessage.addListener((msg) => {
  const { url, code } = msg;
  if (!url) return;

  console.log('Content script received:', msg);

  if (url.includes('luogu.com.cn')) handleLuogu(code);
  else if (url.includes('codeforces.com')) handleCodeforce(code);
  else if (url.includes('nowcoder.com')) handleNowcoder(code);
  else console.log('Default action:', msg);
});


function handleLuogu(code) {
  console.log('Executing Luogu handler');

  const editorSelector =
    'div.cm-content.cm-lineWrapping[contenteditable="true"]';

  const submitBtnSelector =
    'button.solid.lform-size-middle[type="button"][style*="margin-top: 1em"]';

  const MAX_WAIT = 15000; // 最长等待 15s
  const startTime = Date.now();

  /* ---------------- 工具：清空 + 写入 ---------------- */
  function setEditorContent(editor, value) {
    // 聚焦编辑器
    editor.focus();

    // 全选清空（适配 CodeMirror6）
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    console.log('Editor cleared');

    // 插入新代码
    const lines = value.split('\n');

    lines.forEach((line, index) => {
      document.execCommand('insertText', false, line);
      if (index !== lines.length - 1) {
        document.execCommand('insertLineBreak');
      }
    });

    console.log('Code inserted into editor');
  }

  /* ---------------- 提交函数 ---------------- */
  function trySubmit(editor, submitBtn, observer) {
    if (!editor || !submitBtn) return;

    setEditorContent(editor, code);

    submitBtn.click();
    console.log('Clicked submit button ✅');

    observer.disconnect();
  }

  /* ---------------- MutationObserver ---------------- */
  const observer = new MutationObserver(() => {
    // 超时丢弃
    if (Date.now() - startTime > MAX_WAIT) {
      console.warn('Luogu handler timeout, aborting');
      observer.disconnect();
      return;
    }

    const editor = document.querySelector(editorSelector);
    const submitBtn = document.querySelector(submitBtnSelector);

    if (editor && submitBtn) {
      trySubmit(editor, submitBtn, observer);
    }
  });

  /* ---------------- 启动监听 ---------------- */
  const body = document.querySelector('body');

  if (body) {
    observer.observe(body, {
      childList: true,
      subtree: true,
    });
  } else {
    console.error('Body not found!');
  }

  /* ---------------- 兜底立即检测一次 ---------------- */
  setTimeout(() => {
    const editor = document.querySelector(editorSelector);
    const submitBtn = document.querySelector(submitBtnSelector);

    if (editor && submitBtn) {
      trySubmit(editor, submitBtn, observer);
    }
  }, 500);
}


function handleNowcoder(code) {
  const escapedCode = code.replace(/`/g, '\\`').replace(/\$/g, '\\$'); // 避免模板字符串冲突
  const scriptContent = `
    (function() {
      // 找到页面上的 CodeMirror 实例
      const cmContainers = document.querySelectorAll('.CodeMirror');
      if (!cmContainers.length) {
        console.warn('No CodeMirror instance found');
        return;
      }

      // 取第一个 CodeMirror 实例
      const cmContainer = cmContainers[0];
      const cm = cmContainer.CodeMirror || cmContainer.nextSibling?.CodeMirror;

      if (!cm) {
        console.warn('CodeMirror API not found');
        return;
      }

      // 清空原有内容
      cm.setValue('');
      console.log('Cleared existing code in CodeMirror');

      // 插入新的代码
      cm.setValue(\`${escapedCode}\`);
      console.log('Inserted new code via CodeMirror API');

      // 找到提交按钮并点击
      const submitBtn = document.querySelector('button.btn-submit');
      if (submitBtn) {
        submitBtn.click();
        console.log('Clicked "保存并提交" button');
      } else {
        console.warn('Submit button not found');
      }
    })();
  `;

  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function handleCodeforce(payload) {
  console.log('Executing Codeforces handler');

  const { code, problem } = payload;

  /* ---------------- 工具：等待元素 ---------------- */
  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const interval = 200;
      let elapsed = 0;

      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
        }

        elapsed += interval;
        if (elapsed >= timeout) {
          clearInterval(timer);
          reject(`Timeout waiting for ${selector}`);
        }
      }, interval);
    });
  }

  /* ---------------- 工具：安全写入 textarea ---------------- */
  function setTextareaValue(el, value) {
    // 清空原内容
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // 写入新代码
    el.value = value;

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('Textarea cleared and new code inserted');
  }

  (async () => {
    try {
      /* ---------------- 1️⃣ 选择题号 ---------------- */

      let problemSelected = false;

      // select 模式
      const select = document.querySelector(
        'select[name="submittedProblemIndex"]'
      );

      if (select) {
        const option = select.querySelector(
          `option[value="${problem}"]`
        );

        if (option) {
          select.value = problem;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          problemSelected = true;
          console.log('Problem selected via select:', problem);
        }
      }

      // input 模式
      if (!problemSelected) {
        const input = document.querySelector(
          'input[name="submittedProblemCode"]'
        );

        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));

          input.value = problem;
          input.dispatchEvent(new Event('input', { bubbles: true }));

          problemSelected = true;
          console.log('Problem filled via input:', problem);
        }
      }

      if (!problemSelected) {
        console.warn('Problem selector not found');
      }

      /* ---------------- 2️⃣ 切换 textarea 编辑器 ---------------- */

      const toggle = await waitForElement('#toggleEditorCheckbox');

      if (!toggle.checked) {
        toggle.click();
        console.log('Editor toggled to textarea mode');
      }

      /* ---------------- 3️⃣ 写入代码（先清空） ---------------- */

      const textarea = await waitForElement('#sourceCodeTextarea');

      setTextareaValue(textarea, code);

      /* ---------------- 4️⃣ 点击提交 ---------------- */

      const submitBtn = await waitForElement(
        '#singlePageSubmitButton'
      );

      console.log('Submit button found, submitting...');

      submitBtn.click();

      console.log('Submission triggered ✅');

    } catch (err) {
      console.error('Codeforces handler error:', err);
    }
  })();
}

