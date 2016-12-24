#!/usr/bin/env node

'use strict';

// Native
const path = require('path');

// NPM
const browserify  = require('metalsmith-browserify');
const browserSync = require('metalsmith-browser-sync');
const collections = require('metalsmith-collections');
const drafts      = require('metalsmith-drafts');
const fingerprint = require('metalsmith-fingerprint-ignore');
const fs          = require('fs');
const htmlmin     = require('metalsmith-html-minifier');
const layouts     = require('metalsmith-layouts');
const markdown    = require('metalsmith-markdown');
const marked      = require('marked');
const metalsmith  = require('metalsmith');
const moveup      = require('metalsmith-move-up');
const msif        = require('metalsmith-if');
const pagination  = require('metalsmith-pagination');
const permalinks  = require('metalsmith-permalinks');
const prism       = require('metalsmith-prism');
                    require('prismjs/components/prism-c');
                    require('prismjs/components/prism-objectivec');
const sass        = require('metalsmith-sass');
const uglify      = require('metalsmith-uglify');

// Custom
const addScript        = require('./scripts/plugins/add-scripts');
const addStyle         = require('./scripts/plugins/add-styles');
const githubHelper     = require('./scripts/plugins/github-page-helper');
const fingerprintMeta  = require('./scripts/plugins/fingerprint-meta');
const partialExtractor = require('./scripts/plugins/partial-extractor');
const remove           = require('./scripts/plugins/remove');
const replaceVersion   = require('./scripts/plugins/replace-version');
const sassAutoprefixer = require('./scripts/plugins/sass-autoprefixer');

const production = (process.env.NODE_ENV === 'production');

metalsmith(path.join(__dirname))
	.use((files, metalsmith, done) => {
		// Force clear metadata cache, fixes collection duplicates
		// https://github.com/segmentio/metalsmith-collections/issues/27
		setImmediate(done);
		metalsmith.metadata({
			site: require(path.join(__dirname, 'src/content/site.json')),
			package: require(path.join(__dirname, 'package.json'))
		});
	})
	.use(drafts())
	.use(browserify('assets/js/bundle.js', [
			'./src/assets/app/app.js',
			'./src/assets/app/main.js'
		], {
			transform: [
				['babelify', {presets: ['es2015']}]
			],
			debug: !production
		}
	))
	.use(replaceVersion())
	.use(msif(
		production,
		uglify({
			nameTemplate: '[name].[ext]',
			filter: ['assets/js/bundle.js']
		})
	))
	.use(sassAutoprefixer())
	.use(sass({
		outputDir: 'assets/css',
		sourceMap: !production,
		sourceMapContents: !production
	}))
	.use(msif(
		production,
		fingerprint({
			pattern: ['**/css/*.css', '**/js/*.js', '**/*.svg', '**/*.jpg', '!**/fonts/*.svg']
		})
	))
	.use(githubHelper({
		path: 'content/projects.html',
		layout: 'projects-index.hbs',
		endpoints: {
			repos: '/users/reedd/repos?type=owner&sort=updated'
		}
	}))
	.use(collections({
		posts: {
			pattern: 'content/blog/**/*',
			sortBy: 'date',
			reverse: true,
			refer: false
		}
	}))
	.use(pagination({
		'collections.posts': {
			perPage: 10,
			layout: 'blog-index.hbs',
			first: 'blog/index.html',
			path: 'blog/:num/index.html'
		}
	}))
	.use(addStyle())
	.use(addScript())
	.use(moveup({
		pattern: 'content/**/*'
	}))
	.use(markdown({
		breaks: true,
		langPrefix: 'language-',
		renderer: new marked.Renderer()
	}))
	.use(prism())
	.use(permalinks({
		relative: false
	}))
	.use(layouts({
		engine: 'handlebars',
		directory: 'src/layouts',
		pattern: '**/*.html',
		partials: 'src/layouts/partials',
		helpers: {
			eq: require('./scripts/helpers/eq.js'),
			neq: require('./scripts/helpers/neq.js'),
			math: require('./scripts/helpers/math.js'),
			pathjs: require('./scripts/helpers/path.js'),
			moment: require('helper-moment')
		}
	}))
	.use(partialExtractor())
	.use(msif(
		production,
		fingerprintMeta()
	))
	.use(htmlmin({
		removeAttributeQuotes: false,
		processScripts: ['text/ng-template']
	}))
	.use(remove({
		pattern: ['**/layouts/**', '**/app/**', 'site.json']
	}))
	.use(msif(
		!production,
		browserSync({
			open: false,
			server: './build',
			files: ['src/**/*']
		}, function (err, bs) {
			bs.addMiddleware('*', function (req, res) {
				res.writeHead(404);
				res.write(fs.readFileSync('./build/404/index.html'));
				res.end();
			});
		})
	))
	.destination(path.join(__dirname, 'build'))
	.build(err => {
		if (err) {
			throw err;
		}
	});