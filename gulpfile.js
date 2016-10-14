var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    sass = require('gulp-sass'),
    cleanCSS = require('gulp-clean-css'),
    flatten = require('gulp-flatten'),
    concat = require('gulp-concat');

gulp.task('script', function() {
    return gulp.src(['src/bower/jquery/dist/jquery.js',
                     'src/bower/bootstrap-sass/assets/javascripts/bootstrap.js',
                     'src/bower/ace-builds/src-noconflict/ace.js',
                     'src/bower/moment/moment.js',
                     'src/script/cms.js'
                   ], {base: './src'})
               .pipe(uglify())
               .pipe(concat('cms.min.js'))
               .pipe(gulp.dest('static/script/'));
});

gulp.task('script-ace-assets', function() {
    return gulp.src(['src/bower/ace-builds/src-noconflict/theme-github.js',
                     'src/bower/ace-builds/src-noconflict/*-html.js',
                     'src/bower/ace-builds/src-noconflict/*-javascript.js',
                     'src/bower/ace-builds/src-noconflict/*-json.js'], {base: './'})
               .pipe(flatten())
               .pipe(gulp.dest('static/script/ace/'));
});


gulp.task('style', function() {
  return gulp.src('src/style/cms.scss')
             .pipe(sass({
               paths: [ 'src/' ]
             }))
             .pipe(cleanCSS())
             .pipe(gulp.dest('static/css/'));
});

gulp.task('fonts', function() {
    return gulp.src(['src/bower/font-awesome/fonts/*',
                     'src/bower/bootstrap-sass/assets/fonts/bootstrap/*'], {base: './'})
               .pipe(flatten())
               .pipe(gulp.dest('static/fonts/'));
});

gulp.task('watch', function() {
  gulp.watch('./src/script/*.js', ['script']);
  gulp.watch('./src/style/*.scss', ['style']);
});

gulp.task('default', ['script', 'script-ace-assets', 'style', 'fonts']);
