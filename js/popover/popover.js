"use strict";

var globalPage = GlobalPage.window();

if (!globalPage.GlobalPageReady) {
	Log('Waiting for global page to be ready...');

	window.location.reload();
} else
	globalPage.Log('Ready to go.');

globalPage.Template = Template;

// Allow direct access to required variables contained within the global page.
(function () {
	var required = ['$', 'jQuery', 'console', 'globalSetting', 'Settings', 'Promise', 'Store'];

	for (var i = 0; i < required.length; i++)
		window[required[i]] = globalPage[required[i]];

	window.$ = function (selector, context) {
		if (typeof context === 'undefined')
			return jQuery(selector, document);

		return jQuery(selector, context);
	};

	for (var key in jQuery)
		if (jQuery.hasOwnProperty(key))
			$[key] = jQuery[key];
})();

window.addEventListener('error', function (event) {
	console.group('Popover Error');

	console.log('GOT AN ERROR', event)

	LogError([event.filename.replace(ExtensionURL(), '/'), event.lineno], event.message);

	console.groupEnd();
});

Template.load('container');
Template.load('main');
// Template.load('rules');
// Template.load('snapshots');