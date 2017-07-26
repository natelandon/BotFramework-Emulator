var gulp = require('gulp');
var pjson = require('./package.json');

//============================================================================
// BUILD
//============================================================================

//----------------------------------------------------------------------------
gulp.task('clean', function () {
    var clean = require('gulp-clean');
    return gulp.src('./app/', { read: false })
        .pipe(clean());
});

//----------------------------------------------------------------------------
gulp.task('build-app', function () {
    var tsc = require('gulp-tsc');
    var tsconfig = require('./tsconfig.json');
    return gulp.src(['src/**/*.ts', 'src/**/*.tsx'])
        .pipe(tsc(tsconfig.compilerOptions))
        .pipe(gulp.dest('app/'));
});

//----------------------------------------------------------------------------
gulp.task('build-site', function () {
    return gulp.src([
        './src/**/*.html',
        './src/**/*.css'])
        .pipe(gulp.dest('app/'));
});

//----------------------------------------------------------------------------
gulp.task('build', ['clean'], function() {
    return gulp.start([
        'build-app',
        'build-site'
    ]);
});


//============================================================================
// GET-LICENSES
//============================================================================

//----------------------------------------------------------------------------
gulp.task('get-licenses', function () {
    var licenses = require('license-list');
    var source = require('vinyl-source-stream');
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


//============================================================================
// PACKAGE
//============================================================================

//----------------------------------------------------------------------------
gulp.task('package:windows', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    const config = Object.assign({},
        replacePackageEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-windows.json'));
    return builder.build({
        targets: builder.Platform.WINDOWS.createTarget(["nsis", "zip"], builder.Arch.ia32, builder.Arch.x64),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = setReleaseFilename(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});

//----------------------------------------------------------------------------
gulp.task('package:squirrel.windows', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    const config = Object.assign({},
        replacePackageEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-squirrel.windows.json'));
    return builder.build({
        targets: builder.Platform.WINDOWS.createTarget(["squirrel"], builder.Arch.x64),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = setReleaseFilename(path.basename, {
                    lowerCase: false,
                    replaceName: true,
                    srcName: config.productName,
                    dstName: config.squirrelWindows.name
                });
            }))
            .pipe(gulp.dest('./dist'));
    });
});

//----------------------------------------------------------------------------
gulp.task('package:mac', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    const config = Object.assign({},
        replacePackageEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-mac.json'));
    return builder.build({
        targets: builder.Platform.MAC.createTarget(["dmg", "zip"]),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = setReleaseFilename(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});

//----------------------------------------------------------------------------
gulp.task('package:linux', function() {
    var rename = require('gulp-rename');
    var builder = require('electron-builder');
    const config = Object.assign({},
        replacePackageEnvironmentVars(require('./build/build-common.json')),
        require('./build/build-linux.json'));
    return builder.build({
        targets: builder.Platform.LINUX.createTarget(["deb", "AppImage"], builder.Arch.ia32, builder.Arch.x64),
        config
    }).then((filenames) => {
        gulp.src(filenames)
            .pipe(rename(function (path) {
                path.basename = setReleaseFilename(path.basename);
            }))
            .pipe(gulp.dest('./dist'));
    });
});


//============================================================================
// PUBLISH
//============================================================================

//----------------------------------------------------------------------------
function publishFiles(filelist) {
    var CancellationToken = require('electron-builder-http/out/CancellationToken').CancellationToken;
    var GitHubPublisher = require('electron-publish/out/gitHubPublisher').GitHubPublisher;
    var MultiProgress = require('electron-publish/out/multiProgress').MultiProgress;
    var publishConfig = replacePublishEnvironmentVars(require('./build/build-publish.json'));

    const context = {
        cancellationToken: new CancellationToken(),
        progress: new MultiProgress()
    };
    const publisher = new GitHubPublisher(
        context,
        publishConfig,
        pjson.version, {
            publish: "always",
            draft: true,
            prerelease: true
        });
    const errorlist = [];

    const uploads = filelist.map(file => {
        return publisher.upload(file)
            .catch((err) => {
                errorlist.push(err.response ? `Failed to upload ${file}, http status code ${err.response.statusCode}` : err);
                return Promise.resolve();
            });
    });

    return Promise.all(uploads)
    .then(() => errorlist.forEach((err) => console.error(err)));
}

//----------------------------------------------------------------------------
gulp.task('publish:windows', function () {
    const filelist = getFileList("windows", {
        path: './dist/'
    });
    return publishFiles(filelist);
});

//----------------------------------------------------------------------------
gulp.task('publish:squirrel.windows', function () {
    const basename = require('./build/build-squirrel.windows.json').squirrelWindows.name;
    const filelist = getFileList("squirrel.windows", {
        basename,
        path: './dist/'
    });
    return publishFiles(filelist);
});

//----------------------------------------------------------------------------
gulp.task('publish:mac', function () {
    const filelist = getFileList("mac", {
        path: './dist/'
    });
    return publishFiles(filelist);
});

//----------------------------------------------------------------------------
gulp.task('publish:linux', function () {
    const filelist = getFileList("linux", {
        path: './dist/'
    });
    return publishFiles(filelist);
});


//============================================================================
// UTILS
//============================================================================

//----------------------------------------------------------------------------
function getFileList(platform, options = {}) {
    options = Object.assign({}, {
        basename: pjson.name,
        version: pjson.version,
        path: './'
    }, options);
    const filelist = [];
    switch (platform) {
        case "windows":
            filelist.push(`${options.path}latest.yml`);
            filelist.push(`${options.path}${options.basename}-setup-${options.version}.exe`);
            filelist.push(`${options.path}${options.basename}-${options.version}-win.zip`);
            filelist.push(`${options.path}${options.basename}-${options.version}-ia32-win.zip`);
        break;

        case "squirrel.windows":
            filelist.push(`${options.path}RELEASES`);
            filelist.push(`${options.path}${options.basename}-Setup-${options.version}.exe`);
            filelist.push(`${options.path}${options.basename}-${options.version}-full.nupkg`);
        break;

        case "mac":
            filelist.push(`${options.path}latest-mac.yml`);
            filelist.push(`${options.path}latest-mac.json`);
            filelist.push(`${options.path}${options.basename}-${options.version}-mac.zip`);
            filelist.push(`${options.path}${options.basename}-${options.version}.dmg`);
        break;

        case "linux":
            filelist.push(`${options.path}${options.basename}-${options.version}-i386.AppImage`);
            filelist.push(`${options.path}${options.basename}-${options.version}-x86_64.AppImage`);
            filelist.push(`${options.path}${options.basename}_${options.version}_i386.deb`);
            filelist.push(`${options.path}${options.basename}_${options.version}_amd64.deb`);
        break;
    }
    return filelist;
}

//----------------------------------------------------------------------------
function setReleaseFilename(filename, options = {}) {
    options = Object.assign({}, {
        lowerCase: true,
        replaceWhitespace: true,
        fixBasename: true,
        replaceName: false,
        srcName: null,
        dstName: null
    },
    options);
    if (options.replaceName && options.srcName && options.dstName) {
        filename = filename.replace(options.srcName, options.dstName);
    }
    if (options.lowerCase) {
        filename = filename.toLowerCase();
    }
    if (options.replaceWhitespace) {
        filename = filename.replace(/\s/g, '-');
    }
    if (options.fixBasename) {
        filename = filename.replace(/bot[-|\s]framework/ig, 'botframework');
    }
    return filename;
}

//----------------------------------------------------------------------------
function replaceEnvironmentVar(str, name, defaultValue = undefined) {
    if (process.env[name] === undefined && defaultValue === undefined)
        throw new Error(`Required environment variable missing: ${name}`);
    let value = (process.env[name] === undefined) ? defaultValue : process.env[name]
    return str.replace(new RegExp('\\${' + name + '}', 'g'), value);
}

//----------------------------------------------------------------------------
function replacePackageEnvironmentVars(obj) {
    let str = JSON.stringify(obj);
    str = replaceEnvironmentVar(str, "ELECTRON_MIRROR");
    return JSON.parse(str);
}

//----------------------------------------------------------------------------
function replacePublishEnvironmentVars(obj) {
    let str = JSON.stringify(obj);
    str = replaceEnvironmentVar(str, "GITHUB_TOKEN");
    return JSON.parse(str);
}

// EOF
