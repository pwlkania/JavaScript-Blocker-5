/*
JS Blocker 5 (http://jsblocker.toggleable.com) - Copyright 2015 Travis Lee Roman
*/

"use strict";

UI.Setup = {
	init: function () {
		if (!Settings.getItem('installID'))
			Settings.setItem('installID', Utilities.Token.generate() + '-' + Version.display + '-' + Version.bundle);

		if (Settings.getItem('setupComplete'))
			return;	

		UI.Setup.view = $('#main-views-setup', UI.view.views);

		UI.Setup.view.append(Template.create('setup', 'setup-container'));

		UI.view.switchTo('#main-views-setup');

		UI.event.addCustomEventListener('viewWillSwitch', UI.Setup.preventViewSwitch);
		Poppy.Menu.event.addCustomEventListener('poppyMenuWillShow', UI.Setup.preventPoppyMenus);

		UI.Setup.view
			.on('click', '#mark-setup-complete', UI.Setup.complete);
	},

	complete: function () {
		Settings.setItem('setupComplete', true);

		UI.view.switchTo('#main-views-page');

		UI.Setup.view.empty();

		Template.unload('setup');

		UI.event.removeCustomEventListener('viewWillSwitch', UI.Setup.preventViewSwitch);
		Poppy.Menu.event.removeCustomEventListener('poppyMenuWillShow', UI.Setup.preventPoppyMenus);
	},

	preventViewSwitch: function (event) {
		if (event.detail.to.id._startsWith('#main-views')) {
			if (!Settings.getItem('setupComplete')) {
				event.preventDefault();

				var poppy = new Poppy(event.pageX, event.pageY, true);

				poppy.setContent(Template.create('main', 'jsb-readable', {
					string: _('setup.please_complete')
				}));

				poppy.show();
			}	else
				event.unbind();
		}
	},

	preventPoppyMenus: function (event) {
		if (!Settings.getItem('setupComplete'))
			event.preventDefault();
	}
};

document.addEventListener('DOMContentLoaded', UI.Setup.init, true);
