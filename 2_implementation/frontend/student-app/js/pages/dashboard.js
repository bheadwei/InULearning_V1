// Dashboard page logic to fetch analytics data and render charts

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        try {
            // 更新登入狀態 UI（若可用）
            if (typeof authManager !== 'undefined' && authManager) {
                try { authManager.updateAuthUI(); } catch (_) { }
            }
            // 確認 token 存在再載入資料
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const radarContainer = document.getElementById('subjectChart');
            const trendContainer = document.getElementById('trendChart');

            if (radarContainer) {
                radarContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500"><span class="material-icons mr-2">bar_chart</span>載入圖表中...</div>';
            }
            if (trendContainer) {
                trendContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500"><span class="material-icons mr-2">trending_up</span>載入圖表中...</div>';
            }

            // Fetch radar, trend, recent list, and statistics in parallel
            const [radarData, trendData, recentList, statsResp] = await Promise.all([
                window.learningAPI.getSubjectRadar({ window: '30d' }),
                window.learningAPI.getSubjectTrend({ metric: 'accuracy', window: '30d', limit: 100 }),
                window.learningAPI.getRecentLearningRecords(5),
                window.learningAPI.getLearningStatistics()
            ]);

            // Render charts
            if (radarContainer) {
                await window.renderSubjectRadar('subjectChart', radarData);
            }
            if (trendContainer) {
                await window.renderSubjectTrend('trendChart', trendData);
            }

            // 同步最近練習記錄到 dashboard（若存在相同樣式區塊）
            const recentSessions = document.getElementById('recentSessions');
            if (recentSessions && recentList && recentList.data && recentList.data.sessions) {
                const records = recentList.data.sessions || [];
                if (!records.length) {
                    recentSessions.innerHTML = '<div class="flex items-center justify-center py-8 text-gray-500"><span class="material-icons mr-2">history</span>暫無練習記錄</div>';
                } else {
                    recentSessions.innerHTML = records.map(record => {
                        const startTime = new Date(record.start_time);
                        const minutes = record.time_spent ? Math.floor(record.time_spent / 60) : 0;
                        const seconds = record.time_spent ? record.time_spent % 60 : 0;
                        const duration = record.time_spent ? `${minutes}分${seconds}秒` : '未記錄';
                        const correct = record.correct_count || 0;
                        const total = record.question_count || 0;
                        const acc = total > 0 ? Math.round(record.accuracy_rate || 0) : 0;
                        return `
            <div class="p-4 bg-white rounded-lg border hover:bg-gray-50">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <span class="material-icons">quiz</span>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900">${record.session_name || `${record.subject || '未分類'} 練習測驗`}</div>
                    <div class="text-xs text-gray-500">${startTime.toLocaleString('zh-TW')} · ${duration} · ${total} 題</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-medium text-gray-900">${correct}/${total}</div>
                  <div class="text-xs text-gray-500">正確率 ${acc}%</div>
                </div>
              </div>
            </div>`;
                    }).join('');
                }
            }

            // 將統計卡片與 history 頁一致的欄位同步
            const totalSessionsEl = document.getElementById('totalSessions');
            const totalQuestionsEl = document.getElementById('totalQuestions');
            const avgAccuracyEl = document.getElementById('avgAccuracy');
            const totalTimeEl = document.getElementById('totalTime');

            // 優先使用 statistics API（與 history.html 一致），若無則回退 recentList 彙總
            const stats = statsResp && statsResp.success ? statsResp.data : null;
            if (stats) {
                const totalSessions = stats.total_sessions || 0;
                const totalQuestions = stats.total_questions || 0;
                const accuracy = Math.round(stats.overall_accuracy || 0);
                const minutes = Math.round((stats.total_time_spent || 0) / 60);
                if (totalSessionsEl) totalSessionsEl.textContent = totalSessions;
                if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions;
                if (avgAccuracyEl) avgAccuracyEl.textContent = `${accuracy}%`;
                if (totalTimeEl) totalTimeEl.textContent = `${minutes} 分`;
            } else if (recentList && recentList.data) {
                const sessions = recentList.data.sessions || [];
                const totalSessions = recentList.data.total || sessions.length;
                const totalQuestions = sessions.reduce((sum, s) => sum + (s.question_count || 0), 0);
                const correct = sessions.reduce((sum, s) => sum + (s.correct_count || 0), 0);
                const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
                const timeSpent = sessions.reduce((sum, s) => sum + (s.time_spent || 0), 0);
                const minutes = Math.round(timeSpent / 60);
                if (totalSessionsEl) totalSessionsEl.textContent = totalSessions;
                if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions;
                if (avgAccuracyEl) avgAccuracyEl.textContent = `${accuracy}%`;
                if (totalTimeEl) totalTimeEl.textContent = `${minutes} 分`;
            }
        } catch (err) {
            console.error('Dashboard init error:', err);
            const radarContainer = document.getElementById('subjectChart');
            const trendContainer = document.getElementById('trendChart');
            if (radarContainer) {
                radarContainer.innerHTML = '<div class="text-red-500">圖表載入失敗</div>';
            }
            if (trendContainer) {
                trendContainer.innerHTML = '<div class="text-red-500">圖表載入失敗</div>';
            }
        }
    }, 100);
});


