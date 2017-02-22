var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    sass = require('gulp-sass'),
    cssimport = require("gulp-cssimport"),
    cleanCSS = require('gulp-clean-css'),
    flatten = require('gulp-flatten'),
    concat = require('gulp-concat');

gulp.task('script', () => {
    return gulp.src(['src/bower/jquery/dist/jquery.js',
                     'src/bower/bootstrap-sass/assets/javascripts/bootstrap.js',
                     'src/bower/ace-builds/src-noconflict/ace.js',
                     'src/bower/moment/moment.js',
                     'src/bower/datatables.net/js/jquery.dataTables.js',
                     'src/bower/datatables.net-bs/js/dataTables.bootstrap.js',
                     'src/script/cms.js'
                   ], {base: './src'})
               .pipe(uglify())
               .pipe(concat('cms.min.js'))
               .pipe(gulp.dest('static/script/'));
});

gulp.task('script-typeahead', () => {
    return gulp.src(['src/bower/typeahead.js/dist/typeahead.bundle.js',
                     'src/bower/typeahead.js/dist/typeahead.jquery.js'
                   ], {base: './src'})
               .pipe(uglify())
               .pipe(concat('typeahead.min.js'))
               .pipe(gulp.dest('static/script/'));
});

gulp.task('script-ace-assets', () => {
    return gulp.src(['src/bower/ace-builds/src-noconflict/theme-github.js',
                     'src/bower/ace-builds/src-noconflict/*-html.js',
                     'src/bower/ace-builds/src-noconflict/*-javascript.js',
                     'src/bower/ace-builds/src-noconflict/*-json.js'], {base: './'})
               .pipe(flatten())
               .pipe(gulp.dest('static/script/ace/'));
});


gulp.task('style', () => {
  return gulp.src('src/style/cms.scss')
             .pipe(sass({
               paths: [ 'src/' ]
             }))
             .pipe(cssimport())
             .pipe(cleanCSS())
             .pipe(gulp.dest('static/css/'));
});

gulp.task('fonts', () => {
    return gulp.src(['src/bower/font-awesome/fonts/*',
                     'src/bower/bootstrap-sass/assets/fonts/bootstrap/*'], {base: './'})
               .pipe(flatten())
               .pipe(gulp.dest('static/fonts/'));
});

gulp.task('watch', () => {
  gulp.watch('./src/script/*.js', ['script']);
  gulp.watch('./src/style/*.scss', ['style']);
});

gulp.task('default', ['script', 'script-typeahead', 'script-ace-assets', 'style', 'fonts']);
