/*global $ ace*/
var CMS = {
  createEditor: function(id) {
    var editor = ace.edit(id),
        input = $('#'+id),
        form = input.parents('form:first');

    editor.setTheme("ace/theme/github");
    if(input.data('ace-format')) {
      editor.session.setMode("ace/mode/"+input.data('ace-format'));
    } else {
      editor.session.setMode("ace/mode/html");
    }
    editor.setAutoScrollEditorIntoView(true);
    editor.setOption("maxLines", 300);
    editor.setOption("tabSize", 2);
    editor.setOption("useSoftTabs", true);

    form.on('submit', function(e) {
      form.append($("<input>").attr("type", "hidden").attr("name", input.data('field')).val(editor.getValue()));
    });
    return editor;
  }
};
ace.config.set("basePath", "/static/js/ace");
