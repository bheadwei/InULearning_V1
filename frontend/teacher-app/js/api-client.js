const apiClient = {
	baseUrl: '/api/v1',  // 使用相對路徑，通過前端 nginx 代理到主 nginx
	getToken() {
		return (
			localStorage.getItem('auth_token') ||
			sessionStorage.getItem('auth_token') ||
			localStorage.getItem('teacher_token') ||
			sessionStorage.getItem('teacher_token') ||
			''
		);
	},
	async request(path, options = {}) {
		const url = `${this.baseUrl}${path}`;
		const headers = Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, options.headers || {});
		const token = this.getToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;
		
		console.log('🌐 API 請求:', url); // 添加日誌
		console.log('🌐 請求選項:', options); // 添加更多日誌
		
		// 強制設置必要的選項
		const fetchOptions = {
			method: options.method || 'GET',
			headers: headers,
			...options
		};
		
		// 如果是 POST/PUT 且有 body，確保 body 被設置
		if ((options.method === 'POST' || options.method === 'PUT') && options.body) {
			fetchOptions.body = options.body;
		}
		
		console.log('🌐 最終 fetch 選項:', fetchOptions); // 添加更多日誌
		
		const res = await fetch(url, fetchOptions);
		let data = {};
		try { data = await res.json(); } catch (_) {}
		if (!res.ok) {
			if (res.status === 401) {
				localStorage.removeItem('auth_token');
				sessionStorage.removeItem('auth_token');
				localStorage.removeItem('teacher_token');
				sessionStorage.removeItem('teacher_token');
			}
			throw new Error(data.detail || data.message || 'Request failed');
		}
		return data;
	},
	get(path) { return this.request(path, { method: 'GET' }); },
	post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
	put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
	patch(path, body) { return this.request(path, { method: 'PATCH', body: JSON.stringify(body) }); },
	delete(path) { return this.request(path, { method: 'DELETE' }); },
};

window.apiClient = apiClient;

