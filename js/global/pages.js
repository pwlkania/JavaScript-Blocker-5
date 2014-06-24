"use strict";

function Page (page, tab) {
	if (!Page.isPage(page))
		throw new TypeError('page state is not an instance of Object');

	page.state.props = {
		destroyChildren: true,
		selfDestruct: TIME.ONE_MINUTE * 5
	};

	page.state = Store.promote(page.state);

	page.state.forEach(function (state, kinds, store) {
		kinds.forEach(function (kind, resources, store) {
			resources.getStore('source').map(function (sourceName, source) {
				return source.map(function (location, attributes) {
					return new Resource({
						kind: kind,
						pageLocation: location,
						source: sourceName,
						isFrame: attributes.isFrame,
						ruleAction: attributes.ruleAction,
						unblockable: attributes.unblockable,
						meta: attributes.meta
					});
				}, true);
			}, true);
		});
	});

	var storedPage = Page.pages.get(page.state.name);

	this.retries = storedPage ? storedPage.retries : 0;
	this.info = page;
	this.tab = tab;
	this.isTop = !page.isFrame;

	Page.pages.set(page.state.name, this);

	this.frames = Page.frames.getStore(page.state.name);
};

Page.pages = new Store('Pages', {
	maxLife: TIME.ONE_MINUTE * 10
});

Page.frames = new Store('Frames', {
	maxLife: TIME.ONE_MINUTE * 10
});

Page.active = function (callback) {
	var active = Page.pages.findLast(function (pageID, page, store) {
		return (page.isTop && page.tab === Tabs.active());
	});

	if (active && typeof callback === 'function')
		callback(active);
};

Page.isPage = function (page) {
	return (page && page.state instanceof Object);
};

Page.clearBadge = function (event) {
	ToolbarItems.badge(0, event.target);
};

Page.removePagesWithTab = function (event) {
	Page.pages.forEach(function (pageID, page, store) {
		if (page.tab === event.target) {
			store.remove(pageID);
			
			Page.frames.remove(pageID);
		}
	});
};

Page.removeMissingPages = function (event) {
	setTimeout(function () {
		var currentTabs = Tabs.array();

		Page.pages.only(function (pageID, page, store) {
			return currentTabs._contains(page.tab);
		});

		Page.frames.only(function (pageID, page, store) {
			return Page.pages.keyExist(pageID);
		});
	}, 50);
};

Page.requestPage = function (event) {
	if (event.target instanceof SafariBrowserTab) {
		MessageTarget(event, 'sendPage');

		Page.await(event.target);
	}
};

Page.requestPageFromActive = function (event) {
	Tabs.messageActive('sendPage');

	Page.await(Tabs.active());
};

Page.await = function (awaitTab, done) {
	if (done)
		return Utilities.Timer.remove('timeout', awaitTab);

	Utilities.Timer.timeout(awaitTab, function () {
		Tabs.all(function (tab) {
			if (tab === awaitTab)
				ToolbarItems.badge(0, tab);
		});
	}, 300);
}

Page.prototype.addFrame = function (frame) {
	if (!(frame instanceof Page))
		frame = new Page(frame);

	if (this.info.id === frame.info.id)
		throw new Error('a page cannot be its own frame');

	if (frame.info.protocol === 'about:' || this.info.host === frame.info.host) {		
		frame.merged = true;

		var myState,
				myResources,
				myHosts;

		var self = this;

		if (!Array.isArray(this.info.locations))
			this.info.locations = [this.info.location];

		this.info.locations._pushMissing(frame.info.location);			

		frame.info.state.forEach(function (state, kinds, stateStore) {
			myState = self.info.state.getStore(state);

			kinds.forEach(function (kind, resources, kindStore) {
				if (!myState.keyExist(kind))
					myState.set(kind, resources);
				else {
					myResources = myState.getStore(kind);
					myHosts = myResources.getStore('hosts');

					myResources.getStore('all').merge(resources.getStore('all'), true);
					myResources.getStore('source').merge(resources.getStore('source'), true);

					resources.getStore('hosts').forEach(function (host, count, hostStore) {
						myHosts.increment(host, count);
					});
				}
			});
		});
	}

	this.frames.set(frame.info.id, frame);
	
	return this;
};

Page.prototype.badge = function (state) {
	if (!this.isTop)
		return;

	Page.await(this.tab, true);

	Utilities.Timer.timeout('badgeToolbar' + this.info.state.name, function (self) {
		var tree = self.tree(),
				count = 0;

		var withState = function (kind, resources) {
			count += Object.keys(resources.hosts || []).length;
		};

		for (var kind in tree.state[state])
			withState(kind, tree.state[state][kind]);

		for (var frame in tree.frames) 
			for (kind in tree.frames[frame].state[state])
				if (Rules.kindShouldBadge(kind))
					withState(kind, tree.frames[frame].state[state][kind]);

		ToolbarItems.badge(count, self.tab);
	}, 50, [this]);
};

Page.prototype.tree = function () {
	if (!this.isTop)
		throw new Error('a tree can only be generated by a top page');

	var info = this.info._clone();

	info.state = info.state.all();

	info.frames = {};

	this.frames.forEach(function (frameID, frame, store) {
		if (!frame.merged) {
			info.frames[frameID] = frame.info._clone();

			info.frames[frameID].state = info.frames[frameID].state.all();
		}
	});

	return info;
};

Events.addApplicationListener('beforeNavigate', Page.clearBadge);
Events.addApplicationListener('beforeNavigate', Page.removePagesWithTab);
Events.addApplicationListener('close', Page.removeMissingPages);
Events.addApplicationListener('activate', Page.requestPage);
Events.addApplicationListener('popover', Page.requestPageFromActive);
