"use strict";

UI.Settings = {
	__hidden: ['userScript-edit'],

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
				hide: UI.Settings.__hidden._contains(sections[i]),
				value: _('settings.' + sections[i])
			};

		UI.Settings.toolbar.append(Template.create('main', 'view-switcher', viewSwitcherData));

		UI.Settings.viewSwitcher = $('.view-switcher', UI.Settings.view);

		for (var i = 0; i < sections.length; i++)
			UI.view.create('setting-views', sections[i], UI.Settings.views);

		UI.Settings.userScriptEdit = $('#setting-views-userScript-edit', UI.Settings.views);

		UI.Settings.events.viewSwitcher();

		try {
			UI.view.switchTo(Settings.getItem('settingCurrentView'));
		} catch (error) {
			LogError('failed to switch to setting view', error);
		}

		UI.Settings.views
			.on('input', '.user-script-content', function () {
				this.setAttribute('data-blockViewSwitch', 1);
			})

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

	bindUserScriptSettings: function (userScriptSettings) {
		for (var i = userScriptSettings.length; i--;) {
			var element = $(userScriptSettings[i]);

			if (element.attr('data-userScriptSettingsBound'))
				return;

			try {
				var attributeValue = globalPage.UserScript.getAttribute(element.attr('data-userScript'), element.attr('data-attribute'));
			} catch (eror) {
				return;
			}

			element.attr('data-userScriptSettingsBound', 1);

			element
				.prop('checked', attributeValue)
				.change(function () {
					try {
						globalPage.UserScript.setAttribute(this.getAttribute('data-userScript'), this.getAttribute('data-attribute'), this.checked);
					} catch (error) {}
				});
		}
	},

	bindUserScriptStorageEdit: function (userScriptStorages) {
		for (var i = userScriptStorages.length; i--;) {
			var element = $(userScriptStorages[i]);

			if (element.attr('data-userScriptStorageBound'))
				return;

			try {
				var storageItem = globalPage.UserScript.getStorageItem(element.attr('data-userScript'), element.attr('data-storageKey'));
			} catch (error) {
				return;
			}

			try {
				var storageItemValue = JSON.stringify(storageItem);
			} catch (e) {
				var storageItemValue = '';
			}

			element.attr('data-userScriptStorageBound', 1);

			if (element.is('.user-script-storage-item-delete'))
				element
					.parent()
					.on('click', '.user-script-storage-item-delete', function () {
						var userScriptNS = this.getAttribute('data-userScript');

						try {
							var storage = globalPage.UserScript.getStorageItem(userScriptNS);
						} catch (error) {
							return;
						}

						var result = UI.Settings.saveUserScriptEdit(this, true);

						if (result) {
							storage.remove(this.getAttribute('data-storageKey'));

							UI.Settings.editUserScript(userScriptNS);
						}
					});
			else
				element
					.val(storageItemValue)
					.on('blur keypress', function (event) {
						if (this.disabled || (event.which && event.which !== 3 && event.which !== 13))
							return;

						try {
							var storage = globalPage.UserScript.getStorageItem(this.getAttribute('data-userScript'));
						} catch (error) {
							return;
						}

						if (this.value === 'undefined') {
							storage.remove(this.getAttribute('data-storageKey'));

							this.disabled = true;

							this.blur();
						} else
							try {
								storage.set(this.getAttribute('data-storageKey'), JSON.parse(this.value), true);

								this.classList.add('jsb-color-allowed');

								setTimeout(function (self) {
									self.classList.remove('jsb-color-allowed');
								}, 1500, this);
							} catch (e) {
								this.classList.add('jsb-color-blocked');

								setTimeout(function (self) {
									self.classList.remove('jsb-color-blocked');
								}, 1500, this);
							}
					});
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
						var offset = $(this).offset(),
								poppy = new Poppy(Math.floor(offset.left - 10), Math.floor(offset.top + 10), true);

						poppy.setContent(Template.create('main', 'jsb-readable', {
							string: _(success)
						}));

						poppy.show();
					}
				});
		}
	},

	createList: function (container, settings, disabled) {
		if (!settings)
			return;

		var setting,
				settingItem,
				settingElement,
				listSetting,
				shouldRender,
				subContainer;

		var allSettings = Settings.all();

		for (var i = 0; i < settings.length; i++) {
			setting = settings[i];

			if (setting.customView)
				setting.customView(container);

			else if (setting.divider)
				container.append(Template.create('settings', 'setting-section-divider'));

			else if (setting.header)
				container.append(Template.create('settings', 'setting-section-header', {
					header: _('setting.' + setting.header),
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

	repopulateActiveSection: function (force) {
		var activeSettingView = $('.active-view', UI.Settings.views),
				focusedTextInput = $('textarea:focus, input[type="text"]:focus', activeSettingView);

		if (force || (!focusedTextInput.length && activeSettingView.is(':not(#setting-views-userScript-edit)')))
			UI.Settings.populateSection(activeSettingView, $('.active-view', UI.Settings.views).attr('data-section'));
	},

	saveUserScriptEdit: function (button, noSwitch) {
		var userScript = $('.user-script-content', UI.Settings.views),
				userScriptContent = userScript.val(),
				result = globalPage.UserScript.add(userScriptContent);

		if (result === true) {
			userScript.removeAttr('data-blockViewSwitch');

			if (!noSwitch)
				UI.view.switchTo('#setting-views-userScripts');
		} else if (button) {
			var offset = $(button).offset(),
					poppy = new Popover.window.Poppy(Math.floor(offset.left + 7), Math.floor(offset.top + 12), false);

			poppy.setContent(Template.create('main', 'jsb-readable', {
				string: _('setting.saveUserScript.fail')
			})).show();
		}

		return result === true;
	},

	editUserScript: function (userScriptNS) {
		UI.Settings.userScriptEdit.attr('data-userScriptNS', userScriptNS);

		UI.event.addCustomEventListener('viewWillScrollToTop', function (event) {
			event.preventDefault();
		}, true);

		UI.view.switchTo('#setting-views-userScript-edit');

		try {
			var meta = globalPage.UserScript.getAttribute(userScriptNS, 'meta'),
					script = globalPage.UserScript.getAttribute(userScriptNS, 'script'),
					storage = globalPage.UserScript.getStorageItem(userScriptNS);
		} catch (e) {
			return;
		}

		var list = $('ul', UI.Settings.userScriptEdit);

		$('.setting-section-divider', list).nextAll().addBack().remove();

		list
			.append(Template.create('settings', 'setting-section-divider'))
			.append(Template.create('settings', 'setting-section-header', {
				header: _('setting.userScript.storage', [meta.name._escapeHTML()])
			}))
			.append(Template.create('settings', 'setting-section-description', {
				id: 'description-' + Utilities.Token.generate(),
				description: _('setting.newUserScriptStorageItem.description')
			}));

		$('.user-script-content', UI.Settings.userScriptEdit).val(script);

		if (storage && !storage.isEmpty()) {
			var sortedStorage = storage.keys().sort().reverse();

			for (var i = sortedStorage.length; i--;)
				list.append(Template.create('settings', 'user-script-storage-item', {
					userScript: userScriptNS,
					key: sortedStorage[i],
					value: storage.get(sortedStorage[i])
				}));
		}

		var element = UI.Settings.createElementForSetting(Settings.map.newUserScriptStorageItem, null, true),
				wrapper = Template.create('settings', 'setting-section-setting', {
					setting: 'newUserScriptStorageItem'
				}, true);

		$('li', wrapper).append(element.children());

		list.append(wrapper.children());
	},

	events: {
		viewSwitcher: function () {
			UI.Settings.viewSwitcher
				.on('click', 'li', function (event) {
					var viewID = this.getAttribute('data-view');

					if (!viewID._endsWith('userScript-edit'))
						Settings.setItem('settingCurrentView', viewID);
				});
		},

		poppyDidShow: function (event) {
			UI.Settings.viewContainer.unbind('scroll', Poppy.closeAll).one('scroll', Poppy.closeAll);
		},

		elementWasAdded: function (event) {
			if (event.detail.querySelectorAll) {
				UI.Settings.bindInlineSettings(event.detail.querySelectorAll('*[data-inlineSetting]'));
				UI.Settings.bindUserScriptSettings(event.detail.querySelectorAll('*[data-attribute]'));
				UI.Settings.bindUserScriptStorageEdit(event.detail.querySelectorAll('*[data-storageKey]'));
				UI.Settings.bindDynamicSettingNew(event.detail.querySelectorAll('.setting-dynamic-new-container'));
			}
		},

		viewWillSwitch: function (event) {
			if (!event.detail.to.id._startsWith('#setting-views'))
				return;

			if ($('.user-script-content', UI.Settings.userScriptEdit).attr('data-blockViewSwitch')) {
				event.preventDefault();

				var poppy = new Poppy(0.5, 0, true, 'user-script-confirm-view-switch');

				poppy
					.modal()
					.setContent(Template.create('poppy', 'user-script-confirm-view-switch', {
						viewID: event.detail.to.id
					}))
					.show();
			}

			UI.Settings.populateSection(event.detail.to.view, event.detail.to.view.attr('data-section'));
		}
	}
};

UI.event.addCustomEventListener('poppyDidShow', UI.Settings.events.poppyDidShow);
UI.event.addCustomEventListener('elementWasAdded', UI.Settings.events.elementWasAdded);
UI.event.addCustomEventListener('viewWillSwitch', UI.Settings.events.viewWillSwitch);

document.addEventListener('DOMContentLoaded', UI.Settings.init, true);

Template.load('settings');
