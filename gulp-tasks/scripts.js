/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var gulp = require('gulp');
var del = require('del');
var runSequence = require('run-sequence');
var eslint = require('gulp-eslint');
var path = require('path');
var glob = require('glob');
var browserify = require('browserify');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var streamify = require('gulp-streamify');
var replace = require('gulp-replace');
var license = require('gulp-license');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var rollup = require('gulp-rollup');

gulp.task('scripts:watch', function() {
  gulp.watch(GLOBAL.config.src + '/**/*.js',
    ['scripts', GLOBAL.config.browserSyncReload]);
  gulp.watch(['./.eslintrc', './.eslintignore'], ['scripts'])
    .on('change', function() {
      if (GLOBAL.config.browserSync) {
        GLOBAL.config.browserSync.reload();
      }
    });
});

// Takes a set of objects defining inputs of javascript files
// to run through browserify and babelify
function compileES6Bundles(browserifyBundles, cb) {
  // Check if there is anything to do
  if (browserifyBundles.length === 0) {
    return cb();
  }

  var finishedCount = 0;
  browserifyBundles.forEach(function(bundle) {
    var browserifyBundle = browserify({
      entries: [bundle.srcPath]
    })
    .transform('babelify', {presets: ['es2015']});

    try {
      return browserifyBundle.bundle()
        .on('log', gutil.log.bind(gutil, 'Browserify Log'))
        .on('error', function(err) {
          gutil.log('Browserify Error', err);
          this.emit('end');
        })
        .pipe(source(bundle.outputFilename))
        .pipe(replace(/@VERSION@/g, GLOBAL.config.version))

        // If this is a production build - minify JS
        .pipe(gulpif(GLOBAL.config.env === 'prod', streamify(uglify())))
        .pipe(license(GLOBAL.config.license, GLOBAL.config.licenseOptions))
        .pipe(gulp.dest(bundle.dest))
        .on('end', function() {
          finishedCount++;

          if (finishedCount === browserifyBundles.length) {
            cb();
          }
        });
    } catch (exception) {
      console.log(exception);
    }
  });
}

gulp.task('scripts:eslint', function() {
  return gulp.src([GLOBAL.config.src + '/**/*.js'])

    // eslint() attaches the lint output to the eslint property,
    // of the file object so it can be used by other modules.
    .pipe(eslint())

    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe(eslint.format())

    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failOnError last.
    .pipe(gulpif(GLOBAL.config.env === 'prod', eslint.failOnError()));
});

gulp.task('scripts:es6', function(cb) {
  var stream = gulp.src(GLOBAL.config.src + '/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(rollup())
    .pipe(babel({
      presets: ['es2015']
    }));

  if (GLOBAL.config.env === 'prod') {
    stream = stream.pipe(uglify());
  }

  return stream.pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(GLOBAL.config.dest));
});

// Delete any files currently in the scripts destination path
gulp.task('scripts:clean', function(cb) {
  del([GLOBAL.config.dest + '/**/*.js'], {dot: true})
    .then(function() {
      cb();
    });
});

gulp.task('scripts', function(cb) {
  runSequence(
    [
      'scripts:clean',
      'scripts:eslint'
    ],
    [
      'scripts:es6'
    ],
    cb
  );
});
