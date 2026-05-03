/* global ace */

window.CMS = {
  createEditor(id) {
    const editor = ace.edit(id);
    const input = document.getElementById(id);
    const form = input.closest('form');
    const format = input.dataset.aceFormat || 'html';
    const field = input.dataset.field;

    editor.setTheme('ace/theme/github');
    editor.session.setMode(`ace/mode/${format}`);
    editor.setAutoScrollEditorIntoView(true);
    editor.setOption('maxLines', 300);
    editor.setOption('tabSize', 2);
    editor.setOption('useSoftTabs', true);

    if (form && field) {
      form.addEventListener('submit', () => {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = field;
        hidden.value = editor.getValue();
        form.append(hidden);
      });
    }

    return editor;
  }
};

ace.config.set('basePath', '/static/script/ace');
