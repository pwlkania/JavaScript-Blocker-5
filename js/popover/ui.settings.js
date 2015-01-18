"use strict";

UI.Settings = {
	init: function () {
		UI.Settings.view = $('#main-views-setting', UI.view.views);

		UI.Settings.view.append(Template.create('settings', 'setting-container'));

		UI.Settings.toolbar = $('#setting-toolbar', UI.Settings.view);
		UI.Settings.viewContainer = $('#setting-views-container', UI.Settings.view);
		UI.Settings.views = $('#setting-views', UI.Settings.viewContainer);

		var sections = Object.keys(Settings.settings).filter(function (value) {
			return !value._startsWith('__');
		});

		var viewSwitcherData = {
			container: '#setting-views-container',
			views: {}
		};

		for (var i = 0; i < sections.length; i++)
			viewSwitcherData.views['#setting-views-' + sections[i]] = {
				value: _('settings.' + sections[i])
			};

		UI.Settings.toolbar.append(Template.create('main', 'view-switcher', viewSwitcherData));

		UI.Settings.viewSwitcher = $('.view-switcher', UI.Settings.view);

		for (var i = 0; i < sections.length; i++)
			UI.view.create('setting-views', sections[i], UI.Settings.views);

		UI.Settings.events.viewSwitcher();

		try {
			UI.view.switchTo(Settings.getItem('settingCurrentView'));
		} catch (error) {
			LogError('failed to switch to setting view', error);
		}

		UI.Settings.views
			.on('click', '*[data-settingButton]', function (event) {
				var settingName = this.getAttribute('data-settingButton'),
						setting = Settings.map[settingName];

				if (setting.props.onClick) {
					if (setting.props.validate && !setting.props.validate.test()) {
						var poppy = new Poppy(event.originalEvent.pageX, event.originalEvent.pageY, true);

						poppy
							.setContent(Template.create('main', 'jsb-readable', {
								string: _('setting.' + setting.props.validate.onFail)
							}))
							.show();

						return;
					}

					setting.props.onClick(this);
				}
			})

			.on('click', '.more-info', function (event) {
				var poppy = new Poppy(event.originalEvent.pageX, event.originalEvent.pageY, true);

				poppy
					.setContent(Template.create('main', 'jsb-readable', {
						string: this.getAttribute('data-moreInfo')
					}))
					.show();
			});
	},

	bindInlineSettings: function (inlineSettings) {
		for (var i = inlineSettings.length; i--;) {
			var element = $(inlineSettings[i]);

			if (element.attr('data-inlineSettingBound'))
				return;

			element.attr('data-inlineSettingBound', 1);

			var settingName = element.attr('data-inlineSetting'),
					storeKey = element.attr('data-storeKey'),
					settingRef = Settings.map[settingName],
					storeSetting = settingRef.storeKeySettings ? settingRef.storeKeySettings[storeKey] : null,
					settingType = storeSetting && storeSetting.props.type || settingRef.props.type,
					currentValue = Settings.getItem(settingName, storeKey);

			switch (settingType) {
				case 'option':
				case 'option-radio':
					currentValue = currentValue.toString();

					if (settingType === 'option') {
						var options = $('option', element);

						for (var b = options.length; b--;) 
							if (options[b].value.toString() === currentValue) {
								element[0].selectedIndex = b;

								break;
							}
					} else if (currentValue === element.val())
						element.prop('checked', true);

					element.change(function () {
						if (this.checked !== false) {
							var value = this.value === 'false' ? false : this.value;

							Settings.setItem(this.getAttribute('data-inlineSetting'), value, this.getAttribute('data-storeKey'));
						}
					});
				break;

				case 'range':
					element
						.val(currentValue)
						.change(function () {
							Settings.setItem(this.getAttribute('data-inlineSetting'), this.value, this.getAttribute('data-storeKey'));
						});
				break;

				case 'boolean':
					element
						.prop('checked', currentValue)
						.change(function () {
							Settings.setItem(this.getAttribute('data-inlineSetting'), this.checked, this.getAttribute('data-storeKey'));
						});
				break;

				case 'dynamic-array':
					element
						.prop('checked', currentValue.enabled)
						.change(function () {
							var setting = this.getAttribute('data-inlineSetting'),
									storeKey = this.getAttribute('data-storeKey'),
									currentValue = Settings.getItem(setting, storeKey)._clone();

							currentValue.enabled = this.checked;

							Settings.setItem(setting, currentValue, storeKey);
						});

					var remove = element.parent().nextAll('.setting-dynamic-delete');

					if (remove.length)
						remove.click(function () {
							var container = $(this).parents('li');

							Settings.removeItem(container.attr('data-setting'), container.attr('data-storeKey'));
						});
				break;
			}
		}
	},

	bindDynamicSettingNew: function (containers) {
		for (var i = containers.length; i--;) {
			var container = $(containers[i]);

			if (container.attr('data-dynamicNewBound'))
				continue;

			container.attr('data-dynamicNewBound', 1);

			container
				.on('click', '.setting-dynamic-restore', function () {
					var newContainer = $(this).parents('.setting-dynamic-new-container');

					Settings.removeItem(newContainer.attr('data-setting'));
				})

				.on('click', '.setting-dynamic-new-save', function (event) {
					var newContainer = $(this).parents('.setting-dynamic-new-container'),
							newName = $.trim($('.setting-dynamic-new-name', newContainer).val()),
							newContent = $.trim($('.setting-dynamic-new-content', newContainer).val());

					if (!newName.length || !newContent.length)
						return;

					var success = Settings.setItem(newContainer.attr('data-setting'), {
						enabled: true,
						value: [newContent, newName]
					}, '$' + Utilities.Token.generate());

					if (success !== true) {
						var position = $(this).offset(),
								poppy = new Poppy(position.left - 10, position.top + 10, true);

						poppy.setContent(Template.create('main', 'jsb-readable', {
							string: _(success)
						}));

						poppy.show();
					}
				});
		}
	},

	createList: function (container, settings, disabled) {
		var setting,
				settingItem,
				settingElement,
				listSetting,
				shouldRender,
				subContainer;

		var allSettings = Settings.all();

		for (var i = 0; i < settings.length; i++) {
			setting = settings[i];

			if (setting.divider)
				container.append(Template.create('settings', 'setting-section-divider'));

			else if (setting.header)
				container.append(Template.create('settings', 'setting-section-header', {
					header: setting.header,
					level: setting.level
				}));

			else if (setting.description)
				container.append(Template.create('settings', 'setting-section-description', {
					id: setting.id || ('description-' + Utilities.Token.generate()),
					description: _('setting.' + setting.description, setting.fill ? setting.fill() : [])
				}));

			else if (setting.when) {
				shouldRender = Utilities.Group.eval(setting.when.settings, allSettings);

				if (shouldRender || !setting.when.hide)
					this.createList(container, setting.settings, !shouldRender || disabled);

			} else if (setting.setting || (setting.store && setting.props && setting.props.isSetting)) {
				if (setting.props) {
					if (setting.props.remap || setting.props.readOnly)
						continue;

					settingElement = this.createElementForSetting(setting, null, true);

					listSetting = Template.create('settings', 'setting-section-setting', {
						setting: setting.setting || setting.store
					});

					listSetting.append(settingElement.children());

					container.append(listSetting);

					if (disabled)
						listSetting
							.addClass('jsb-disabled')
							.find('input, textarea, select')
							.attr('disabled', true);
					
					if (setting.props.subSettings && !disabled) {
						subContainer = Template.create('settings', 'setting-section-sub-container');

						container.append(subContainer);

						this.createList($('ul', subContainer), setting.props.subSettings);
					}
				}
			}
		}
	},

	createElementForSetting: function (setting, id, wrap) {
		var mappedSetting = Settings.map[setting.setting],
				baseProps = (setting.props.storeKey && mappedSetting.storeKeySettings) ? mappedSetting.props : setting.props;

		var element = Template.create('settings', 'setting-element', {
			id: id || ('setting-element-' + Utilities.Token.generate()),
			setting: setting,
			props: baseProps,
			wrap: wrap
		}, true);

		return element;
	},

	populateSection: function (view, settingSection)  {
		var container = Template.create('settings', 'setting-section-container');

		this.createList(container, Settings.settings[settingSection])

		view.empty().append(container);
	},

	events: {
		viewSwitcher: function () {
			UI.Settings.viewSwitcher
				.on('click', 'li', function (event) {
					UI.view.switchTo(this.getAttribute('data-view'));

					Settings.setItem('settingCurrentView', this.getAttribute('data-view'));
				});
		},

		poppyDidShow: function (event) {
			UI.Settings.viewContainer.unbind('scroll', Poppy.closeAll).one('scroll', Poppy.closeAll);
		},

		elementWasAdded: function (event) {
			if (event.detail.querySelectorAll) {
				UI.Settings.bindInlineSettings(event.detail.querySelectorAll('*[data-inlineSetting]'));
				UI.Settings.bindDynamicSettingNew(event.detail.querySelectorAll('.setting-dynamic-new-container'));
			}
		},

		viewWillSwitch: function (event) {
			if (!event.detail.to.id._startsWith('#setting-views'))
				return;

			UI.Settings.populateSection(event.detail.to.view, event.detail.to.view.attr('data-section'));
		}
	}
};

UI.event.addCustomEventListener('poppyDidShow', UI.Settings.events.poppyDidShow);
UI.event.addCustomEventListener('elementWasAdded', UI.Settings.events.elementWasAdded);
UI.event.addCustomEventListener('viewWillSwitch', UI.Settings.events.viewWillSwitch);

document.addEventListener('DOMContentLoaded', UI.Settings.init, true);

Template.load('settings');