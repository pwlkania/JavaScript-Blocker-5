"use strict";

var Store = (function () {
	var data = {},
			parent = {},
			children = {};

	function Store (name, props) {
		if (!(props instanceof Object))
			props = {};

		this.maxLife = (typeof props.maxLife === 'number') ? props.maxLife : Infinity;
		this.selfDestruct = (typeof props.selfDestruct === 'number') ? props.selfDestruct : 0;
		this.saveDelay = (typeof props.saveDelay === 'number') ? props.saveDelay : 2000;
		this.destroyChildren = !!props.destroyChildren;
		this.lock = !!props.lock;
		this.save = !!props.save;
		this.useSnapshot = !!props.snapshot;
		this.ignoreSave = !!props.ignoreSave;
		this.private = !!props.private;

		if (typeof name === 'string' && name.length)
			this.id = (props.save ? Store.STORE_STRING : Store.CACHE_STRING) + name;
		else
			this.id = Utilities.Token.generate();

		this.isNew = this.private || !data[this.id];

		this.name = name;
		this.props = props;

		if (this.private)
			this.__children[this.id] = {};
		else {
			if (!children[this.id])
				children[this.id] = {};

			Object.defineProperty(this, 'data', {
				enumerable: true,

				get: function () {
					return this.private ? this.__data : data[this.id];
				},
				set: function (value) {
					if (this.private)
						this.__data = value;
					else
						data[this.id] = value;
				}
			});
		}

		this.prolongDestruction();

		var defaultValue = {};

		if (props.defaultValue instanceof Object)
			for (var key in props.defaultValue)
				defaultValue[key] = {
					accessed: Date.now(),
					value: props.defaultValue[key]
				}

		if (!this.data)
			this.load(defaultValue);

		if (this.useSnapshot)
			this.snapshot = new Snapshot(this);

		if (this.maxLife < Infinity) {
			this.cleanupName = 'StoreCleanup' + this.id;

			Utilities.Timer.interval(this.cleanupName, this.removeExpired.bind(this), this.maxLife * .85);
		}

		if (this.save)
			this.addEventListener('save', function () {
				LogDebug('SIZE ' + this.id + ': ' + Utilities.byteSize(this.savedByteSize()));
			}.bind(this));
	};

	Store = Store._extendClass(EventListener);

	Store.__inheritable = ['private', 'ignoreSave', 'maxLife', 'selfDestruct'];

	Store.STORE_STRING = 'Storage-';
	Store.CACHE_STRING = 'Cache-';

	Store.exist = function (storeName) {
		return (storeName in data);
	};

	Store.destroyAll = function () {
		for (var key in Utilities.Timer.timers.timeout)
			if (key._startsWith('SelfDestruct'))
				Utilities.Timer.timers.timeout[key].script.apply(null, Utilities.Timer.timers.timeout[key].args);
	};

	Store.promote = function (object) {
		if (object instanceof Store)
			return object;

		if (!Store.isStore(object))
			throw new TypeError('cannot create store from object');

		var store = new Store(object.name, object.props);

		store.data = object.data || object.STORE;

		return store;
	};

	Store.inherit = function (props, store) {
		for (var i = 0; i < Store.__inheritable.length; i++)
			props[Store.__inheritable[i]] = props[Store.__inheritable[i]] || store[Store.__inheritable[i]];

		return props;
	};

	Store.compare = function (left, right) {
		if (!(left instanceof Store) || !(right instanceof Store))
			throw new TypeError('left or right is not an instance of Store');

		var key,
				thisValue,
				oppositeValue,
				compared,
				comparedSide,
				inside;

		var swap = {
			left: 'right',
			right: 'left'
		};

		var compare = {
			left: left,
			right: right
		};

		if (!Store.compareCache)
			Store.compareCache = new Store('Compare', {
				maxLife: TIME.ONE.MINUTE * 10,
				private: true
			});

		var store = Store.compareCache.getStore(left.name + '-' + right.name);

		var sides = {
			left: store.getStore('left'),
			right: store.getStore('right'),
			both: store.getStore('both')
		};

		for (var side in compare) {
			for (key in compare[side].data) {
				thisValue = compare[side].get(key, null, null, true);
				oppositeValue = compare[swap[side]].get(key, null, null, true);

				if (thisValue === undefined && oppositeValue === undefined)
					sides.both.set(key, undefined)
				else if (oppositeValue === undefined)
					sides[side].set(key, thisValue);
				else if (thisValue instanceof Store) {
					compared = Store.compare(compare.left.getStore(key, null, null, true), compare.right.getStore(key, null, null, true));

					compared.store.parent = store;

					for (comparedSide in sides) {
						inside = compared.sides[comparedSide];

						if (!inside.STORE._isEmpty())
							sides[comparedSide].set(key, inside);
					}
				} else if (JSON.stringify(thisValue) === JSON.stringify(oppositeValue))
					sides.both.set(key, thisValue);
				else if (thisValue !== undefined)
					sides[side].set(key, thisValue);
			}
		}

		sides.left = sides.left.readyJSON();
		sides.right = sides.right.readyJSON();
		sides.both = sides.both.readyJSON();

		return {
			store: store,
			sides: sides,
			equal: (sides.left.STORE._isEmpty() && sides.right.STORE._isEmpty())
		};
	};

	Store.isStore = function (object) {
		return !!(object && object.data && object.props) || object.STORE instanceof Object;
	};

	Object.defineProperty(Store.prototype, 'parent', {
		get: function () {
			return this.private ? this.__parent : parent[this.id];
		},
		set: function (newParent) {
			var hasParent = (this.private ? this.__parent : parent[this.id]) instanceof Store;

			if (hasParent)
				return;

			if (newParent instanceof Store) {
				newParent.children[this.id] = this;

				if (this.private)
					this.__parent = newParent;
				else
					parent[this.id] = newParent;
			} else if (newParent === null) {
				if (this.private)
					this.__parent = undefined;
				else
					delete parent[this.id];

				var childrenReference = this.private ? this.__children : children;

				for (var key in childrenReference)
					delete childrenReference[key][this.id];
			} else
				throw new Error('parent is not null or an instance of Store');
		}
	});

	Object.defineProperty(Store.prototype, 'children', {
		get: function () {
			return this.private ? this.__children[this.id] : children[this.id];
		},
		set: function (v) {
			if (this.private)
				this.__children[this.id] = {};
			else
				children[this.id] = {};
		}
	});

	Store.BREAK = Utilities.Token.generate();

	Store.prototype.__parent = undefined;
	Store.prototype.__data = {};
	Store.prototype.__children = {};

	Store.prototype.__save = function (bypassIgnore, now) {
		if (this.lock || (this.ignoreSave && !bypassIgnore))
			return;

		Utilities.Timer.timeout('StoreSave' + this.id, function (store) {
			store.triggerEvent('presave');

			if (store.save) {
				console.time('SAVED ' + store.id);

				Settings.__method('setItem', store.id, store.readyJSON());

				console.timeEnd('SAVED ' + store.id);
			}

			store.triggerEvent('save');
		}, now ? 0 : this.saveDelay, [this]);

		if (this.parent)
			Utilities.setImmediateTimeout(function (store) {
				store.parent.__save(true);
			}, [this]);
	};

	Store.prototype.savedByteSize = function () {
		return this.save ? JSON.stringify(Settings.__method('getItem', this.id)).length : -1;
	};

	Store.prototype.unlock = function () {
		this.lock = false;
		this.props.lock = false;

		this.forEach(function (key, value) {
			if (value instanceof Store)
				value.unlock();
		});

		this.saveNow();

		return this;
	};

	Store.prototype.saveNow = function (bypassIgnore) {
		this.__save(bypassIgnore, true);
	};

	Store.prototype.load = function (defaultValue) {
		if (this.save) {
			var stored = Settings.__method('getItem', this.id, {
				STORE: defaultValue
			});

			if (stored.lock)
				this.lock = true;

			this.data = stored.STORE || stored.data || {};
		} else
			this.data = defaultValue;
	};

	Store.prototype.reload = function (defaultValue) {
		if (!this.save)
			throw new Error('cannot reload a store that is not saved.');

		this.destroy(true, true);

		delete this.destroyed;

		this.load(defaultValue);
	};

	Store.prototype.triggerEvent = function (name) {
		Utilities.Timer.timeout('StoreTrigger' + this.id + name, function (store, name) {
			store.trigger(name);
		}, 500, [this, name]);
	};

	Store.prototype.isEmpty = function () {
		return !this.data || this.data._isEmpty();
	};

	Store.prototype.keys = function () {
		return Object.keys(this.data);
	};

	Store.prototype.keyExist = function (key) {
		return (key in this.data);
	};

	Store.prototype.clone = function (prefix, props) {
		var value;

		var store = new Store(prefix ? (prefix + ',' + this.name) : this.name, props),
				newData = {};

		for (var key in this.data) {
			value = this.get(key, null, null, true);

			if (value instanceof Store)
				newData[key] = {
					accessed: this.data[key].accessed,
					value: value.clone(prefix, props)
				};
			else if (value !== undefined)
				newData[key] = {
					accessed: this.data[key].accessed,
					value: value
				};
		}

		store.data = newData;

		return store;
	};

	Store.prototype.merge = function (store, deep) {
		if (!(store instanceof Store))
			throw new TypeError(store + ' is not an instance of Store');

		var currentValue,
				storeValue;

		for (var key in store.data) {
			currentValue = this.get(key, null, null, true);
			storeValue = store.get(key, null, null, true);

			if (deep && (currentValue instanceof Store) && (storeValue instanceof Store))
				currentValue.merge(storeValue, true);
			else
				this.set(key, storeValue);
		}

		return this;
	};

	Store.prototype.find = function (fn) {
		if (typeof fn !== 'function')
			throw new TypeError('fn is not a function');

		var value;

		for (var key in this.data) {
			value = this.get(key);

			if (fn(key, value, this))
				break;
		}

		return value;
	};

	Store.prototype.findLast = function (fn) {
		if (typeof fn !== 'function')
			throw new TypeError('fn is not a function');

		var value;

		var keys = this.keys().reverse(),
				found = false;

		for (var i = 0; i < keys.length; i++) {
			value = this.get(keys[i]);

			if (fn(keys[i], value, this)) {
				found = true;

				break;
			}
		}

		return found ? value : null;
	};

	Store.prototype.forEach = function (fn) {
		var value,
				result;

		var results = [];

		for (var key in this.data) {
			value = this.get(key);
			result = fn(key, value, this);

			if (result === Store.BREAK)
				break;

			results.push({
				key: ((result instanceof Object) && result.key) ? result.key : key,
				value: value,
				result: ((result instanceof Object) && result.value) ? result.value : result
			});
		}

		return results;
	};

	Store.prototype.map = function (fn, useSelf) {
		var results = this.forEach(fn);

		var store = useSelf ? this : new Store('Map-' + Utilities.Token.generate(), {
			selfDestruct: TIME.ONE.SECOND * 30
		});

		for (var i = 0; i < results.length; i++)
			store.set(results[i].key, results[i].result);

		return store;
	};

	Store.prototype.filter = function (fn) {
		var results = this.forEach(fn);

		var store = new Store('Filter-' + Utilities.Token.generate(), {
			selfDestruct: TIME.ONE.SECOND * 30
		});

		for (var i = 0; i < results.length; i++)
			if (results[i].result)
				store.set(results[i].key, results[i].value);

		return store;
	};

	Store.prototype.only = function (fn) {
		var results = this.forEach(fn);

		for (var i = 0; i < results.length; i++)
			if (!results[i].result)
				this.remove(results[i].key);

		return this;
	};

	Store.prototype.copy = function (key, newKey) {
		if (!this.keyExist(key))
			throw new Error(key + ' does not exist.');

		return this.set(newKey, this.get(key));
	};

	Store.prototype.move = function (key, newKey) {
		return this.copy(key, newKey).remove(key);
	};

	Store.prototype.replace = function (key, newKey, value) {
		if (typeof value === 'undefined')
			throw new TypeError('value cannot be undefined.');
		
		return this.move(key, newKey).set(newKey, value);
	};

	Store.prototype.set = function (key, value) {
		if (this.lock) {
			if (value instanceof Store) {
				value.lock = true;

				return value;
			}

			return this;
		}

		if (value === null || value === undefined)
			return this;

		setTimeout(function (store) {
			store.prolongDestruction();
		}, 50, this);

		if ((typeof key !== 'string' && typeof key !== 'number') || this.data._hasPrototypeKey(key))
			throw new Error(key + ' cannot be used as key.');

		this.data[key] = {
			accessed: this.data[key] ? this.data[key].accessed : Date.now(),
			value: value,
		};

		if (value instanceof Store)
			value.parent = this;

		if (!this.ignoreSave)
			if (value instanceof Store)
				setTimeout(function (store, value) {
					if (!value.readyJSON().STORE._isEmpty())
						store.__save();
				}, 100, this, value);
			else
				this.__save();

		if (value instanceof Store)
			return this.data[key].value;

		return this;
	};

	Store.prototype.setMany = function (object) {
		if (typeof object === 'object')
			for (var key in object)
				if (object.hasOwnProperty(key))
					this.set(key, object[key]);

		return this;
	};

	Store.prototype.get = function (key, defaultValue, asReference, noAccess) {
		this.prolongDestruction();

		try {
			if (this.data.hasOwnProperty(key)) {
				if (this.maxLife < Infinity && !noAccess)
					Utilities.setImmediateTimeout(function (store, key) {
						if (!store.destroyed && store.data[key]) {
							store.data[key].accessed = Date.now();

							store.__save();
						}
					}, [this, key]);

				var value = this.data[key].value;

				if (!(value instanceof Store)) {
					if (Store.isStore(value)) {
						value.name = (this.name || this.id) + ',' + key;
						value.props = {};

						Store.inherit(value.props, this);

						var promoted = Store.promote(value);

						promoted.parent = this;

						this.data[key] = {
							accessed: Date.now(),
							value: promoted
						};

						return promoted;
					} else if (asReference)
						return value;
					else
						return Object._copy(value, defaultValue);
				} else if (!value.destroyed)
					return value;
			} else if (defaultValue !== undefined && defaultValue !== null)
				return this.set(key, defaultValue).get(key, null, asReference);
		} catch (error) {
			LogError(['ERROR IN GET', this.id, key, this.destroyed], error);
		}
	};

	Store.prototype.getMany = function (keys) {
		return this.filter(function (key) {
			return keys._contains(key);
		});
	};

	Store.prototype.getStore = function (key, defaultProps) {
		var store = this.get(key),
				requiredName = (this.name || this.id) + ',' + key;

		if (!(store instanceof Store)) {
			if (!(defaultProps instanceof Object))
				defaultProps = {};

			Store.inherit(defaultProps, this);

			return this.set(key, new Store(requiredName, defaultProps));
		}

		return store;
	};

	Store.prototype.decrement = function (key, by, start) {
		var current = this.get(key, start || 0);

		if (typeof current !== 'number')
			current = start || 0;

		this.set(key, current - (by || 1));

		return this;
	};

	Store.prototype.increment = function (key, by, start) {
		var current = this.get(key, start || 0);

		if (typeof current !== 'number')
			current = start || 0;

		this.set(key, current + (by || 1));

		return this;
	};

	Store.prototype.remove = function (key, deep) {
		if (this.lock)
			return;

		if (key === undefined) {
			if (this.parent)
				this.parent.forEach(function (key, value, store) {
					if (value === this)
						store.remove(key);
				}.bind(this));

			return this;
		}

		if (this.data.hasOwnProperty(key)) {
			var value = this.get(key, null, null, true);

			if (value instanceof Store)
				value.destroy(deep, false, true);

			delete this.data[key];
		}

		this.__save();

		return this;
	};

	Store.prototype.removeExpired = function () {
		if (this.lock)
			return;

		var value;

		var now = Date.now();

		for (var key in this.data)
			Utilities.setImmediateTimeout(function (store, key, now) {
				if (store.lock)
					return;

				value = store.get(key, null, null, true);

				if (store.data[key] && now - store.data[key].accessed > store.maxLife) {
					if (value instanceof Store)
						value.destroy();

					store.remove(key);
				} else if (value instanceof Store)
					value.removeExpired();
			}, [this, key, now]);
	};

	Store.prototype.replaceWith = function (store) {
		if (!(store instanceof Store))
			throw new TypeError(store + ' is not an instance of Store.');

		if (store === this)
			throw new Error('cannot replace a store with itself.');

		var swapPrefix = this.name ? this.name.split(',')[0] : undefined;

		this.clear();

		this.data = store.readyJSON(swapPrefix).STORE;
	};

	Store.prototype.clear = function (ignoreSave) {
		if (this.lock)
			return;

		for (var child in this.children)
			this.children[child].clear(true);

		this.data = {};

		if (!ignoreSave)
			this.__save();

		return this;
	};

	Store.prototype.destroy = function (deep, unlock, ignoreParent) {
		if (this.destroyed)
			return;

		if (this.cleanupName)
			Utilities.Timer.remove('interval', this.cleanupName);

		var key;

		var self = this;

		if (this.destroyChildren || deep) {
			for (var child in this.children) {
				this.children[child].destroy(true);

				delete this.children[child];
			}

			if (!this.private)
				delete children[this.id];
		}

		if (!ignoreParent && this.parent)
			this.parent.only(function (key, value) {
				return value !== self;
			});

		this.lock = this.lock || !unlock;
		this.data = undefined;

		delete data[this.id];

		Object.defineProperty(this, 'destroyed', {
			configurable: true,
			value: true
		});
	};

	Store.prototype.prolongDestruction = function () {
		if (this.selfDestruct > 0)
			Utilities.Timer.timeout('ProlongDestruction' + this.id, function (store) {
				Utilities.Timer.timeout('SelfDestruct' + store.id, function (store) {
					store.destroy();
				}, store.selfDestruct, [store]);
			}, 500, [this]);
	};

	Store.prototype.all = function () {
		var key,
				value,
				finalValue;

		var object = {};

		for (var key in this.data) {
			value = this.get(key, null, null, true);

			if (value instanceof Store) {
				if (value.isEmpty())
					continue;
				else {
					finalValue = value.all();

					if (finalValue._isEmpty())
						continue;
				}
			} else
				finalValue = value;

			if (finalValue === undefined)
				continue;

			object[key] = finalValue;
		}

		return object;
	};

	Store.prototype.allJSON = function () {
		return JSON.stringify(this.all(), null, 2);
	};

	Store.prototype.readyJSON = function (swapPrefix) {
		var value,
				finalValue;

		var name = (this.name && !this.parent) ? this.name.toString() : null;

		if (name && typeof swapPrefix === 'string' && swapPrefix.length) {
			var split = this.name.split(',');

			split[0] = swapPrefix;

			name = split.join(',');
		}

		var stringable = {
			STORE: {}
		};

		for (var key in this.data) {
			value = this.get(key, null, null, true);

			if (value instanceof Store) {
				if (value.isEmpty())
					continue;
				else {
					finalValue = value.readyJSON(swapPrefix);

					if (finalValue.STORE._isEmpty())
						continue;
				}
			} else
				finalValue = value;

			if (finalValue !== undefined) {
				stringable.STORE[key] = {
					accessed: this.data[key].accessed,
					value: finalValue
				};
			}
		}

		for (var key in stringable.props)
			if (stringable.props[key] === false)
				stringable.props[key] = undefined;

		return stringable;
	};

	Store.prototype.toJSON = function () {
		return this.readyJSON();
	};

	Store.prototype.dump = function  () {
		Log(data);

		return data;
	};

	Store.prototype.expireNow = function () {
		var orig = parseInt(this.maxLife, 10);

		this.maxLife = 1;

		this.removeExpired();
	};

	Store.EMPTY_STORE = new Store('EmptyStore', {
		private: true,
		lock: true
	});

	return Store;
})();
