var gulp = require('gulp');

gulp.task('clean', function () {
    var clean = require('gulp-clean');
    return gulp.src('./app/', { read: false })
        .pipe(clean());
});

gulp.task('build-app', function () {
    var tsc = require('gulp-tsc');
    var tsconfig = require('./tsconfig.json');
    return gulp.src(['src/**/*.ts', 'src/**/*.tsx'])
        .pipe(tsc(tsconfig.compilerOptions))
        .pipe(gulp.dest('app/'));
});

gulp.task('build-site', function () {
    return gulp.src([
        './src/**/*.html',
        './src/**/*.css'])
        .pipe(gulp.dest('app/'));
});

gulp.task('build', ['clean'], function() {
    return gulp.start([
        'build-app',
        'build-site'
    ]);
});

gulp.task('get-licenses', function () {
    var licenses = require('license-list');
    var source = require('vinyl-source-stream');
    var pjson = require('./package.json');
    const stream = source('ThirdPartyLicenses.txt');
    licenses('.', {dev: false}).then(packages => {
        const keys = Object.keys(packages).sort().filter(key => !key.startsWith(`${pjson.name}@`));
        keys.forEach(pkgId => {
            const pkgInfo = packages[pkgId];
            const formatLicense = () => {
                const formatLicenseFile = () => {
                    if (typeof pkgInfo.licenseFile === 'string') {
                        return pkgInfo.licenseFile.split(/\n/).map(line => `\t${line}`).join('\n');
                    } else {
                        return '\tLICENSE file does not exist';
                    }
                }
                return `${pkgInfo.name}@${pkgInfo.version} (${pkgInfo.license})\n\n${formatLicenseFile()}\n\n`;
            }
            stream.write(formatLicense());
        });
        stream.end();
        stream.pipe(gulp.dest('.'));
    });
});

function sanitizeFilenameForWeb(filename) {
    return filename.toLowerCase().replace(/\s/g, '-');
}

function replaceEnvironmentVar(str, name, defaultValue = undefined) {
    if (process.env[name] === undefined && defaultValue === undefined)
        throw new Error(`Required environment variable missing: ${name}`);
    let value = (process.env[name] === undefined) ? defaultValue : process.env[name]
    return str.replace(new RegExp('\\${' + name + '}', 'g'), value);
}

function replaceEnvironmentVars(obj) {
    let str = JSON.stringify(obj);
    str = replaceEnvironmentVar(str, "ELECTRON_CACHE", "./cache");
    str = replaceEnvironmentVar(str, "ELECTRON_MIRROR");
    return JSON.parse(str);
}

gulp.task('package:windows', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    var config = Object.assign({},
        replaceEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-windows.json'));
    return builder.build({
        targets: builder.Platform.WINDOWS.createTarget(["nsis", "zip", "squirrel"], builder.Arch.ia32, builder.Arch.x64),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = sanitizeFilenameForWeb(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});

gulp.task('package:squirrel.windows', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    var config = Object.assign({},
        replaceEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-windows.json'));
    return builder.build({
        targets: builder.Platform.WINDOWS.createTarget(["squirrel"], builder.Arch.x64),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = sanitizeFilenameForWeb(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});

gulp.task('package:mac', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    var config = Object.assign({},
        replaceEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-mac.json'));
    return builder.build({
        targets: builder.Platform.MAC.createTarget(["dmg", "zip"]),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = sanitizeFilenameForWeb(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});

gulp.task('package:linux', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    var config = Object.assign({},
        replaceEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-linux.json'));
    return builder.build({
        targets: builder.Platform.LINUX.createTarget(["deb", "AppImage"], builder.Arch.ia32, builder.Arch.x64),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = sanitizeFilenameForWeb(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});
