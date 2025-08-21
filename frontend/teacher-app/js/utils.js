const Utils = {
	setStorageItem(key, value) {
		try {
			const v = typeof value === 'string' ? value : JSON.stringify(value);
			localStorage.setItem(key, v);
		} catch (_) { /* noop */ }
	},
	getStorageItem(key, defaultValue = null) {
		try {
			const v = localStorage.getItem(key);
			if (v === null) return defaultValue;
			try { return JSON.parse(v); } catch (_) { return v; }
		} catch (_) { return defaultValue; }
	},
	clearStorage() { try { localStorage.clear(); } catch (_) { /* noop */ } },
};

function showLoading() {
	const overlay = document.getElementById('loading-overlay');
	if (overlay) {
		overlay.classList.add('show');
	}
}

function hideLoading() {
	const overlay = document.getElementById('loading-overlay');
	if (overlay) {
		overlay.classList.remove('show');
	}
}

function showAlert(message, type = 'info') {
	console.log(`[${type}]`, message);
}

window.Utils = Utils;

