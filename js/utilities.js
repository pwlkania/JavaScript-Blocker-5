"use strict";

// Global constants =====================================================================

var ARRAY = {
	CONTAINS: {
		ONE: 1,
		ANY: 2,
		ALL: 4,
		NONE: 8
	}
};

var TIME = {
	ONE: {
		SECOND: 1000,
		MINUTE: 1000 * 60,
		HOUR: 1000 * 60 * 60,
		DAY: 1000 * 60 * 60 * 24
	}
};

var LINE_SEPARATOR = '―――――――――――――――';


// Primary utilities ====================================================================

var Utilities = {
	__immediateTimeouts: [],

	safariBuildVersion: parseInt(window.navigator.appVersion.split('Safari/')[1].split('.')[0], 10),

	noop: function () {},

	OSXVersion: function () {
		var osx = window.navigator.userAgent.match(/Mac OS X ([^\)]+)\)/);

		if (!osx[1])
			return null;

		var version = osx[1].split(/_/);

		return version[0] + '.' + version[1];
	},

	makeArray: function (arrayLikeObject, offset) {
		if (typeof offset !== 'number')
			offset = 0;

		return Array.prototype.slice.call(arrayLikeObject, offset);
	},

	setImmediateTimeout: function (fn, args) {
		this.__immediateTimeouts.push({
			fn: fn,
			args: args
		});
		
		if (!Utilities.Page.isWebpage)
			window.postMessage('nextImmediateTimeout', '*');
		else
			GlobalPage.message('bounce', {
				command: 'nextImmediateTimeout'
			});
	},

	nextImmediateTimeout: function () {
		if (this.__immediateTimeouts.length) {
			var next = this.__immediateTimeouts.shift();

			if (typeof next.fn === 'function')
				next.fn.apply(null, next.args);
		}
	},

	decode: function (str) {
		try {
			return decodeURIComponent(escape(atob(str)));
		} catch (e) {
			return str;
		}
	},
	encode: function (str) {
		return btoa(unescape(encodeURIComponent(str)));
	},

	throttle: function (fn, delay, extraArgs, debounce) {
		var timeout = null, last = 0;

		return function () {
			var elapsed = Date.now() - last, args = Utilities.makeArray(arguments).concat(extraArgs || []);

			var execute = function () {
				last = Date.now();

				fn.apply(this, args);
			}

			clearTimeout(timeout);

			if (elapsed > delay && !debounce)
				execute.call(this)
			else
				timeout = setTimeout(execute.bind(this), debounce ? delay : delay - elapsed);
		};
	},

	byteSize: function (number) {	
		var power;

		var number = parseInt(number, 10),
				powers = ['', 'K', 'M', 'G', 'T', 'E', 'P'],
				divisor = /Mac/.test(navigator.platform) ? 1000 : 1024;

		for(var key = 0; key < powers.length; key++) {
			power = powers[key];

			if(Math.abs(number) < divisor)
				break;

			number /= divisor;
		}

		return (Math.round(number * 100) / 100) + ' ' + power + (divisor === 1024 && power.length ? 'i' : '') + (power.length ? 'B' : ('byte' + (number === 1 ? '' : 's')));
	},

	isNewerVersion: function (a, b) {
		var a = typeof a === 'string' ? a : '0',
				b = typeof b === 'string' ? b : '0',
				aModifier = a.split(/[^0-9\.]+/),
				bModifier = b.split(/[^0-9\.]+/),
				aSimpleModifier = a.split(/[0-9\.]+/),
				bSimpleModifier = b.split(/[0-9\.]+/),
				aVersionPieces = aModifier[0].split(/\./),
				bVersionPieces = bModifier[0].split(/\./),
				aModifierCheck = aModifier[1] !== undefined ? parseInt(aModifier[1], 10) : Infinity,
				bModifierCheck = bModifier[1] !== undefined ? parseInt(bModifier[1], 10) : Infinity;

		aModifier[1] = isNaN(aModifierCheck) ? aSimpleModifier[1] : aModifierCheck;
		bModifier[1] = isNaN(bModifierCheck) ? bSimpleModifier[1] : bModifierCheck;

		while (aVersionPieces.length < 6)
			aVersionPieces.push(0);

		while (bVersionPieces.length < 6)
			bVersionPieces.push(0);

		var aVersion = aVersionPieces.join(''), bVersion = bVersionPieces.join('');

		if (aVersion.charAt(0) === '0' || bVersion.charAt(0) === '0') {
			aVersion = '99999' + aVersion;
			bVersion = '99999' + bVersion;
		}

		aVersion = parseInt(aVersion, 10);
		bVersion = parseInt(bVersion, 10);

		return (bVersion > aVersion || (bVersion === aVersion && bModifier[1] > aModifier[1]));
	},

	typeOf: function (object) {
		return ({}).toString.call(object).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
	},

	Group: {
		NONE: 0,
		IS_ANYTHING: 1,
		IS: 2,
		STARTS_WITH: 3,
		ENDS_WITH: 4,
		CONTAINS: 5,
		MATCHES: 6,

		NOT: {
			IS: 7,
			STARTS_WITH: 8,
			ENDS_WITH: 9,
			CONTAINS: 10,
			MATCHES: 11 
		},

		isGroup: function (group) {
			return (group && typeof group === 'object' && typeof group.group === 'string' && Array.isArray(group.items));
		},

		satisfies: function (method, haystack, needle) {
			var type = Utilities.typeOf(needle);

			if (type === 'object')
				return this.eval(needle, haystack);

			if (!this.TYPES[type] || !this.TYPES[type]._contains(method))
				return false;

			switch (method) {
				case this.IS_ANYTHING:
					return (typeof needle !== 'undefined' && needle !== null);
				break;

				case this.IS:
					return haystack === needle;
				break;

				case this.NOT.IS:
					return haystack !== needle;
				break;

				case this.STARTS_WITH:
					return haystack._startsWith(needle);
				break;

				case this.NOT.STARTS_WITH:
					return !haystack._startsWith(needle);
				break;

				case this.ENDS_WITH:
					return haystack._endsWith(needle);
				break;

				case this.NOT.ENDS_WITH:
					return !haystack._endsWith(needle);
				break;

				case this.CONTAINS:
					return haystack._contains(needle);
				break;

				case this.NOT.CONTAINS:
					return !haystack._contains(needle);
				break;

				case this.MATCHES:
					try {
						return (new RegExp(needle)).test(haystack);
					} catch (e) {}
				break;

				case this.NOT.MATCHES:
					try {
						return !(new RegExp(needle)).test(haystack);
					} catch (e) {}
				break;
			}

			return false;
		},

		eval: function (group, subject) {
			if (!this.isGroup(group))
				throw new TypeError(group + ' is not a valid group.');

			if (!group.items.length)
				return true;

			var results = [];

			for (var i = 0; i < group.items.length; i++) {
				if (this.isGroup(group.items[i]))
					results.unshift(this.eval(group.items[i], subject));
				else
					results.unshift(this.satisfies(group.items[i].method, subject[group.items[i].key], group.items[i].needle));

				if (group.group === 'all' && !results[0])
					return false;
			}

			return results._contains(true);
		}
	},

	Timer: {
		timers: {
			interval: {},
			timeout: {}
		},

		__findReference: function (type, reference) {
			var timers = this.timers[type];

			if (typeof reference === 'string')
				return timers[reference] ? reference : undefined;

			for (var timerID in timers)
				if (timers[timerID].reference === reference)
					return timerID;
		},

		__run_interval: function (timerID, isSetter) {
			var interval = this.timers.interval[timerID];

			if (!interval)
				return this.remove('RunInterval' + timerID);

			if (!isSetter)
				interval.script.apply(null, interval.args);

			setTimeout(this.__run_interval.bind(this), interval.time, timerID);
		},

		interval: function () {
			Utilities.setImmediateTimeout(function (timer, args) {
				timer.create.apply(timer, ['interval'].concat(Utilities.makeArray(args)));
			}, [this, arguments]);
		},
		timeout: function () {
			Utilities.setImmediateTimeout(function (timer, args) {
				timer.create.apply(timer, ['timeout'].concat(Utilities.makeArray(args)));
			}, [this, arguments]);
		},
		
		create: function (type, reference, script, time, args) {
			if (!['timeout', 'interval']._contains(type))
				throw new TypeError(type + ' is not a supported timer.');

			if (reference === undefined)
				throw new TypeError('reference cannot be undefined.');

			if (type === 'interval' && typeof reference !== 'string')
				throw new TypeError(reference + ' cannot be used as an interval reference.');
			
			if (!Array.isArray(args))
				args = [];

			this.remove(type, reference);

			var timer = null,
					timerID = typeof reference === 'string' ? reference : Utilities.Token.generate();

			if (type === 'timeout')
				timer = setTimeout(function (timer, type, reference, script, args) {
					script.apply(null, args);

					timer.remove(type, reference);
				}, time, this, type, reference, script, args);

			this.timers[type][timerID] = {
				reference: reference,
				timer: timer,
				args: args,
				time: time,
				script: script
			};

			if (type === 'interval')
				this.__run_interval(timerID, true);
		},
		remove: function () {
			var timerID;

			var args = Utilities.makeArray(arguments),
					type = args.shift();

			if (!args.length) {
				for (timerID in this.timers[type])
					this.remove(type, this.timers[type][timerID].reference);

				return;
			}
	
			for (var i = 0; i < args.length; i++) {
				timerID = this.__findReference(type, args[i]);

				if (timerID) {
					if (type == 'timeout')
						clearTimeout(this.timers[type][timerID].timer);

					delete this.timers[type][timerID];
				}
			}
		}
	},

	Token: (function () {
		var tokens = {},
				characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

		return {
			generate: function () {
				var text = '';

				for (var i = 0; i < 15; i++)
					text += characters[Math.floor(Math.random() * characters.length)];

				return text;
			},
			create: function (value, keep) {
				var token = this.generate();

				if (tokens[token])
					return this.create(value, keep);

				tokens[token] = {
					value: value,
					keep: !!keep
				};

				return token;
			},
			valid: function (token, value, expire) {
				if (typeof token !== 'string' || !(token in tokens))
					return false;

				var isValid = tokens[token].value === value;

				if (expire !== undefined)
					this.expire(token, expire);

				return isValid;
			},
			expire: function (token, expireKept) {
				if ((token in tokens) && (!expireKept || !tokens[token].keep))
					delete tokens[token];
			}
		}
	})(),

	Element: {
		__adjustmentProperties: ['top', 'right', 'bottom', 'left', 'z-index', 'clear', 'float', 'vertical-align', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', '-webkit-margin-before-collapse', '-webkit-margin-after-collapse'],
		
		cloneAdjustmentProperties: function (fromElement, toElement) {
			for (var i = 0; i < this.__adjustmentProperties.length; i++)
				toElement.style.setProperty(this.__adjustmentProperties[i], fromElement.getPropertyValue(this.__adjustmentProperties[i]), 'important');
		},

		setCSSProperties: function (element, properties, isImportant) {
			for (var property in properties)
				element.style.setProperty(property, properties[property], isImportant ? 'important' : '');
		},

		/**
		@function fitFontWithin Adjust the size of a font so that it fits perfectly within containerNode.
		@param {Element} containerNode - Box element that the font should fit within.
		@param {Element} textNode - Element that will have its font size adjusted.
		@param (Element) wrapperNode - Parent element of textNode whose top margin is adjusted so as to be centered within containerNode.
		*/
		fitFontWithin: function (containerNode, textNode, wrapperNode) {
			var currentFontSize = 22,
					maxWrapperHeight = containerNode.offsetHeight,
					maxWrapperWidth = containerNode.offsetWidth - 10, textNodeHeight, textNodeWidth;
						
			do {
				textNode.style.setProperty('font-size', currentFontSize + 'pt', 'important');
				wrapperNode.style.setProperty('margin-top', '-' + ((textNode.offsetHeight / 2) - 3) + 'px', 'important');

				textNodeHeight = textNode.offsetHeight;
				textNodeWidth = textNode.offsetWidth;

				currentFontSize -= 1;
			} while ((textNodeHeight + 3 > maxWrapperHeight || textNodeWidth + 3 > maxWrapperWidth) && currentFontSize > 4);

			this.setCSSProperties(textNode, {
				position: 'absolute',
				top: 'auto',
				left: '50%',
				'margin-left': '-' + Math.round(textNodeWidth / 2) + 'px'
			});
		}
	},

	Page: {
		isXML: document.xmlVersion !== null,
		isGlobal: (window.GlobalPage && GlobalPage.window() === window),
		isPopover: Popover.window() === window,
		isTop: window === window.top,
		isAbout: document.location.protocol === 'about:',

		getCurrentLocation: function () {
			if (['http:', 'https:', 'file:']._contains(document.location.protocol)) {
				var base = document.location.protocol + '//' + document.location.host;

				if (Utilities.safariBuildVersion > 534)
					base += document.location.pathname;
				else
					base += encodeURI(document.location.pathname);

				base += document.location.search;

				if (document.location.hash.length > 0)
					return base + document.location.hash;
				else if (document.location.href.substr(-1) === '#')
					return base + '#';
				else if (/\?$/.test(document.location.href))
					return base + '?';
				else
					return base;
			} else {
				return document.location.href;
			}
		}
	},

	URL: {
		__anchor: document.createElement('a'),
		__structure: /^(blob:)?(https?|s?ftp|file|safari\-extension):\/\/([^\/]+)\//,
		__IPv4: /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(:[0-9]{1,7})?$/,
		__IPv6: /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/,

		isURL: function (url) {
			return typeof url === 'string' && (this.__structure.test(url) || this.protocol(url) === 'about:');
		},

		strip: function (url) {
			if (typeof url !== 'string')
				throw new TypeError(url + ' is not a string.');

			if (url._contains('?'))
				url = url.substr(0, url.indexOf('?'));

			if (url._contains('#'))
				url = url.substr(0, url.indexOf('#'));

			return url;
		},

		getAbsolutePath: function (url) {
			this.__anchor.href = url;

			return this.__anchor.href;
		},

		extractPath: function (url) {
			this.__anchor.href = url;

			return this.__anchor.pathname;
		},

		extractHost: function (url) {
			var url = (typeof url !== 'string') ? Utilities.Page.getCurrentLocation() : url;

			if (/^about:/.test(url))
				return url.substr(6);

			if (/^javascript:/.test(url))
				return 'javascript';

			if (/^data:/.test(url))
				return 'data';

			this.__anchor.href = url;

			return this.__anchor.host;
		},

		hostParts: function (host, prefixed) {
			if (!this.hostParts.cache && window.Store)
				this.hostParts.cache = new Store('HostParts', {
					maxLife: TIME.ONE.HOUR
				});

			var cacheKey = prefixed ? 'prefixed' : 'unprefixed',
					hostStore =  this.hostParts.cache.getStore(host),
					cached = hostStore.get(cacheKey);

			if (cached)
				return cached;

			if (!host._contains('.') || this.__IPv4.test(host) || this.__IPv6.test(host))
				return hostStore.set(cacheKey, [host]).get(cacheKey);

			var split = host.split(/\./g).reverse(),
					part = split[0],
					parts = [],
					eTLDLength = EffectiveTLDs.length,
					sTLDLength = SimpleTLDs.length;

			var part,
					j;
							
			hostLoop:
			for (var i = 1; i < split.length; i++) {
				part = split[i] + '.' + part;

				for (j = 0; j < sTLDLength; j++)
					if (SimpleTLDs[j] === part)
						continue hostLoop;

				for (j = 0; j < eTLDLength; j++)
					if (EffectiveTLDs[j].test(part))
						continue hostLoop;

				parts.push((((i < split.length - 1) && prefixed) ? '.' : '') + part);
			}

			if (!parts.length)
				parts.push(host);

			parts.reverse();

			if (prefixed)
				parts.splice(1, 0, '.' + parts[0]);
			
			return hostStore.set(cacheKey, parts).get(cacheKey);
		},

		origin: function (url) {
			this.__anchor.href = url;

			return this.__anchor.origin;
		},

		protocol: function (url) {
			this.__anchor.href = url;

			return this.__anchor.protocol;
		}
	}
};


// Global functions ==========================================================

var LOG_HISTORY_SIZE = 20;

function Log () {
	var args = Utilities.makeArray(arguments),
			logMessages = Utilities.Page.isGlobal ? args : ['(JSB)'].concat(args);

	Log.history.unshift(logMessages.join(' '));

	Log.history = Log.history._chunk(LOG_HISTORY_SIZE)[0];

	console.log.apply(console, logMessages);
};

Log.history = [];

function LogDebug () {
	if (globalSetting.debugMode) {
		var args = Utilities.makeArray(arguments),
			debugMessages = Utilities.Page.isGlobal ? args : ['(JSB)'].concat(args);

		LogDebug.history.unshift(debugMessages.join(' '));

		LogDebug.history = LogDebug.history._chunk(LOG_HISTORY_SIZE)[0];

		console.warn.apply(console, debugMessages);

		if (Utilities.Page.isWebpage)
			for (var i = 0; i < args.length; i++)
				GlobalPage.message('logDebug', {
					source: document.location.href,
					message: args[i]
				});
	}
};

LogDebug.history = [];

function LogError () {
	var	error,
			errorMessage,
			errorStack;

	var args = Utilities.makeArray(arguments);
			
	for (var i = 0; i < args.length; i++) {
		error = args[i];

		if (error && error.constructor && error.constructor.name && error.constructor.name._endsWith('Error')) {
			errorStack = error.stack ? error.stack.replace(new RegExp(ExtensionURL()._escapeRegExp(), 'g'), '/') : '';

			if (error.sourceURL)
				errorMessage = [error.message, '-', error.sourceURL.replace(ExtensionURL(), '/'),  'line', error.line];
			else
				errorMessage = [error.message];
		} else
			errorMessage = [error];

		LogError.history.unshift(errorMessage);

		LogError.history = LogError.history._chunk(LOG_HISTORY_SIZE)[0];

		if (Utilities.Page.isWebpage)
			GlobalPage.message('logError', {
				source: document.location.href,
				message: errorMessage
			});

		if (Utilities.Page.isGlobal || Utilities.Page.isPopover || globalSetting.debugMode) {
			if (!Utilities.Page.isWebpage)
				errorMessage.unshift('(JSB)');

			console.error.apply(console, errorMessage);

			if (errorStack) {
				console.groupCollapsed('(JSB) Stack');
				console.error(errorStack);
				console.groupEnd();
			}
		}
	}
};

LogError.history = [];


// Native object extensions =============================================================

var Extension = {
	Function: {
		_clone: {
			value: function () {
				var fn = this;

				var cloned = function cloned () {
					return fn.apply(this, arguments);
				};

				for (var key in this)
					if (this.hasOwnProperty(key))
						cloned[key] = this[key];

				return cloned;
			}
		},

		_extendClass: {
			value: function (fn) {
				if (typeof fn !== 'function')
					throw new TypeError(fn + ' is not a function');

				function extended () {
					fn.call(this);

					extended.__originalClass.apply(this, arguments);
				};

				extended.__originalClass = this;

				extended.prototype = Object.create(fn.prototype);

				extended.prototype.constructor = this;

				return extended;
			}
		}
	},

	Array: {
		__contains: {
			value: function (matchType, needle, returnMissingItems) {
				if (typeof matchType !== 'number')
					throw new TypeError(matchType + ' is not a number');
				
				switch(matchType) {
					case ARRAY.CONTAINS.ONE:
						return this.indexOf(needle) > -1;
					break;

					case ARRAY.CONTAINS.ANY:
						if (!Array.isArray(needle))
							throw new TypeError(needle + ' is not an array');

						for (var i = 0, b = needle.length; i < b; i++)
							if (this._contains(needle[i]))
								return true;

						return false;
					break;

					case ARRAY.CONTAINS.ALL:
						if (!Array.isArray(needle))
							throw new TypeError(needle + ' is not an array');

						var missingItems = [];

						for (var i = 0, b = needle.length; i < b; i++)
							if (!this._contains(needle[i]))
								if (returnMissingItems)
									missingItems.push(needle[i]);
								else
									return false;

						if (returnMissingItems)
							return missingItems;
						else
							return true;
					break;

					case ARRAY.CONTAINS.NONE:
						return !this._containsAny(needle);
					break;

					default:
						throw new Error('unsupported match type');
					break;
				}
			}
		},
		_contains: {
			value: function (needle) {
				return this.__contains(ARRAY.CONTAINS.ONE, needle);
			}
		},
		_containsAny: {
			value: function (needle) {
				return this.__contains(ARRAY.CONTAINS.ANY, needle);
			}
		},
		_containsAll: {
			value: function (needle, returnMissingItems) {
				return this.__contains(ARRAY.CONTAINS.ALL, needle, returnMissingItems);
			}
		},
		_containsNone: {
			value: function (needle) {
				return this.__contains(ARRAY.CONTAINS.NONE, needle);
			}
		},

		_clone: {
			value: function () {
				return Utilities.makeArray(this);
			}
		},

		_pushAll: {
			value: function (item) {
				if (!Array.isArray(item))
					item = [item];

				return this.push.apply(this, item);
			}
		},
		_pushMissing: {
			value: function (item) {
				if (!Array.isArray(item))
					item = [item];

				var missingItems = this._containsAll(item, true);

				return this._pushAll(missingItems);
			}
		},

		_unique: {
			value: function() {
				var a = this.concat();

				for(var i = 0; i < a.length; ++i) {
					for(var j = i + 1; j < a.length; ++j) {
						if(a[i] === a[j])
							a.splice(j--, 1);
					}
				}

			return a;
			}
		},

		_chunk: {
			value: function (pieces) {
				var chunks = [[]],
						chunk = 0;

				for (var i = 0, b = this.length; i < b; i++) {
					if (pieces > 0 && chunks[chunk].length >= pieces)
						chunks[++chunk] = [];

					chunks[chunk].push(this[i]);
				}

				return chunks;
			}
		}
	},

	String: {
		_lcut: {
			value: function (length, prefix) {
				var trimmed = this._reverse().substr(0, length)._reverse();

				if (trimmed !== this && prefix)
					trimmed = prefix + trimmed;

				return trimmed;
			}
		},

		_reverse: {
			value: function () {
				return this.split('').reverse().join('');
			}
		},

		_rpad: {
			value: function (length, padding) {
				if (this.length < length) {
					if (padding.length !== 1)
						throw new TypeError(padding + ' is not equal to 1');

					var arr = new Array(length - this.length + 1);

					return this + arr.join(padding);
				}

				return this;
			}
		},

		_contains: {
			value: function (string) {
				return this.indexOf(string) > -1;
			}
		},

		_startsWith: {
			value: function (prefix) {
				return this.indexOf(prefix) === 0;
			}
		},
		_endsWith: {
			value: function (suffix) {
				return this.indexOf(suffix, this.length - suffix.length) > -1;
			}
		},

		_ucfirst: {
			value: function() {
				return this.substr(0, 1).toUpperCase() + this.substr(1);
			}
		},

		_lcfirst: {
			value: function() {
				return this.substr(0, 1).toLowerCase() + this.substr(1);
			}
		},

		_escapeRegExp: {
			value: function () {
				return this.replace(new RegExp('(\\' + ['/','.','*','+','?','|','$','^','(',')','[',']','{','}','\\'].join('|\\') + ')', 'g'), '\\$1');
			}
		},
		_escapeHTML: {
			value: function () {
				return this.replace(/&/g, '&amp;').replace(/</g, '&lt;');
			}
		},

		_format: {
			value: function (args) {
				if (!Array.isArray(args))
					throw new TypeError(args + ' is not an array');

				var string = this.toString();

				for (var i = 0; i < args.length; i++)
					string = string.replace(new RegExp('\\{' + i + '\\}', 'g'), args[i]);
				
				return string;
			}
		}
	},

	Object: {
		_hasPrototypeKey: {
			value: function (key) {
				return ((key in this) && !this.hasOwnProperty(key));
			}
		},

		_getWithDefault: {
			value: function (key, defaultValue) {
				if (key in this)
					return this[key];

				this[key] = defaultValue;

				return this[key];
			}
		},

		_remap: {
			value: function (map) {
				var newObject = {};

				for (var key in this)
					if (this.hasOwnProperty(key) && map.hasOwnProperty(key))
						newObject[map[key]] = this[key];

				return newObject;
			}
		},
		
		_createReverseMap: {
			value: function (deep) {
				for (var key in this)
					if (deep && (this[key] instanceof Object))
						this[key] = this[key]._createReverseMap(deep);
					else
						this[this[key]] = key;

				return this;
			}
		},

		_isEmpty: {
			value: function () {
				return Object.keys(this).length === 0;
			}
		},

		_clone: {
			value: function (deep) {
				var object = {};

				for (var key in this)
					if (deep && Object._isPlainObject(this[key]))
						object[key] = this[key]._clone(true);
					else
						object[key] = Object._copy(this[key]);

				return object;
			}
		},

		_merge: {
			value: function () {
				var object;

				var deep = false,
						objects = Utilities.makeArray(arguments);

				if (objects[0] === true) {
					deep = true;

					objects.shift();
				}

				for (var i = 0; i < objects.length; i++) {
					object = objects[i];

					if (typeof object !== 'object')
						throw new TypeError(object + ' is not an object');

					for (var key in object)
						if (object.hasOwnProperty(key)) {
							if (deep && Object._isPlainObject(this[key]) && Object._isPlainObject(object[key]) && this.hasOwnProperty(key))
								this[key]._merge(true, object[key]);
							else
								this[key] = object[key];
						}
				}

				return this;
			}
		},

		_sort: {
			value: function (fn, reverse) {
				var newObject = {},
						keys = Object.keys(this).sort(fn);

				if (reverse)
					a.reverse();

				for (var i = 0, b = keys.length; i < b; i++)
					newObject[keys[i]] = this[keys[i]];

				return newObject;
			}
		},

		_chunk: {
			value: function (pieces) {
				var size = 0,
						chunk = 0,
						chunks = { 0: {} };

				for (var key in this) {
					if (pieces > 0 && size >= pieces) {
						size = 0;

						chunks[++chunk] = {};
					}

					chunks[chunk][key] = this[key];

					size++;
				}

				return chunks;
			}
		}
	}
};

(function () {
	for (var object in Extension)
		try {
			Object.defineProperties(window[object].prototype, Extension[object]);
		} catch (error) {}
})();

Extension = undefined;

Object._isPlainObject = function (object) {
	return (typeof object === 'object' && object !== null && object.constructor && object.constructor === Object);
};

Object._copy = function (object, defaultValue) {
	var objectType = typeof object;

	switch (true) {
		case object === null:
			return null;
		break;

		case Array.isArray(object):
			return Utilities.makeArray(object);
		break;

		case objectType === 'string':
			return String(object);
		break;

		case objectType === 'number':
			return Number(object);
		break;

		case objectType === 'boolean':
			return Boolean(object);
		break;

		case objectType === 'undefined':
			if (defaultValue !== undefined && defaultValue !== null)
				return defaultValue;

			return object;
		break;

		case objectType === 'object' && object.constructor === Object:
			return object._clone(true);
		break;

		default:
			// LogDebug('getting as reference when not requested as such:', this.id, key, object, cachedKey);

			return object;
		break;
	}
};

Object._extend = function () {
	var deep = false,
			args = Utilities.makeArray(arguments);

	if (args[0] === true) {
		deep = true;

		args.shift();
	}

	var key;

	var base = args.shift();

	for (var i = 0; i < args.length; i ++)
		for (key in args[i])
			if (deep && Utilities.typeOf(base[key]) === 'object' && Utilities.typeOf(args[i][key]) === 'object')
				Object._extend(base[key], args[i][key]);
			else
				base[key] = args[i][key];

	return base;
};

Object._deepFreeze = function (object) {
	Object.freeze(object);

	var props = Object.getOwnPropertyNames(object);

	for (var i = 0; i < props.length; i++)
		if (object[props[i]] !== null && (typeof object[props[i]] === 'object' || typeof object[props[i]] === 'function'))
			Object._deepFreeze(object[props[i]]);

	return object;
};

Utilities.Page.isWebpage = !!GlobalPage.tab && !window.location.href._startsWith(ExtensionURL());
Utilities.Page.isUserScript = window.location.href._endsWith('.user.js');

Utilities.Group.NOT._createReverseMap();
Utilities.Group.TYPES = {
	string: [Utilities.Group.IS_ANYTHING, Utilities.Group.IS, Utilities.Group.NOT.IS, Utilities.Group.STARTS_WITH, Utilities.Group.NOT.STARTS_WITH, Utilities.Group.ENDS_WITH, Utilities.Group.NOT.ENDS_WITH, Utilities.Group.MATCHES, Utilities.Group.NOT.MATCHES, Utilities.Group.CONTAINS, Utilities.Group.NOT.CONTAINS],
	array: [Utilities.Group.IS_ANYTHING, Utilities.Group.IS, Utilities.Group.NOT.IS, Utilities.Group.CONTAINS, Utilities.Group.NOT.CONTAINS],
	boolean: [Utilities.Group.IS_ANYTHING, Utilities.Group.IS, Utilities.Group.NOT.IS]
};


// Event listeners ======================================================================

if (!Utilities.Page.isWebpage)
	window.addEventListener('message', function nextImmediateTimeout (event) {
		if (event.data === 'nextImmediateTimeout')
			Utilities.nextImmediateTimeout();
	}, true);
