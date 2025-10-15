// ===== 状态消息管理 =====
function addStatusMessage(message, type = 'info') {
	const statusDiv = document.querySelector('#statusMessage');
	const timestamp = new Date().toLocaleTimeString('zh-CN');
	
	if (statusDiv.classList.contains('empty-state')) {
		statusDiv.classList.remove('empty-state');
		statusDiv.innerHTML = '';
	}
	
	const messageDiv = document.createElement('div');
	messageDiv.className = `status-item ${type}`;
	messageDiv.innerHTML = `<span class="timestamp">[${timestamp}]</span><span>${message}</span>`;
	statusDiv.appendChild(messageDiv);
	
	const statusArea = document.querySelector('.status-area');
	statusArea.scrollTop = statusArea.scrollHeight;
}

// ===== 文件夹路径管理 =====
let folderCache = {};

async function buildFolderCache() {
	try {
		const folders = await eagle.folder.getAll();
		folderCache = {};
		
		function processFolder(folder, parentPath = '') {
			const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
			folderCache[folder.id] = path;
			
			if (folder.children) {
				folder.children.forEach(child => processFolder(child, path));
			}
		}
		
		folders.forEach(folder => {
			if (!folder.parent) processFolder(folder);
		});
		
		return true;
	} catch (e) {
		console.error('构建文件夹缓存失败:', e);
		return false;
	}
}

function getFolderPath(folderId) {
	return folderCache[folderId] || '';
}

// ===== 文件类型判断 =====
function getFileType(ext) {
	if (!ext) return 'other';
	ext = ext.toLowerCase();
	
	const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
	const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'];
	const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'];
	
	if (imageExts.includes(ext)) return 'image';
	if (videoExts.includes(ext)) return 'video';
	if (docExts.includes(ext)) return 'document';
	return 'other';
}

// ===== 数据提取函数 =====
function extractPersonFromPath(path) {
	if (!path) return '未知';
	return path.split('/')[0].trim();
}

function extractMonthFromPath(path) {
	if (!path) return '未分类';
	const parts = path.split('/');
	
	// 查找 YYYY_MM 格式
	for (const part of parts) {
		const match = part.match(/^(\d{4})_(\d{2})$/);
		if (match) {
			return `${match[1]}年${parseInt(match[2])}月`;
		}
	}
	
	return parts[parts.length - 1] || '未分类';
}

function extractDateFromTag(tag) {
	const match = tag.match(/(\d{1,2})\.(\d{1,2})/);
	if (match) {
		const year = new Date().getFullYear();
		const month = match[1].padStart(2, '0');
		const day = match[2].padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	return '';
}

function extractYearMonth(path) {
	if (!path) return null;
	const match = path.match(/(\d{4})_(\d{2})/);
	return match ? match[1] + match[2] : null;
}

function isInDateRange(yearMonth, start, end) {
	if (!yearMonth) return false;
	const value = parseInt(yearMonth);
	return value >= parseInt(start) && value <= parseInt(end);
}

// ===== CSV生成 =====
function generateCSV(data) {
	if (!data.length) return '';
	
	const headers = Object.keys(data[0]);
	const escape = (field) => {
		if (field == null) return '';
		const str = String(field);
		return str.includes(',') || str.includes('"') || str.includes('\n')
			? `"${str.replace(/"/g, '""')}"`
			: str;
	};
	
	let csv = '\ufeff'; // UTF-8 BOM
	csv += headers.map(escape).join(',') + '\n';
	data.forEach(row => {
		csv += headers.map(h => escape(row[h])).join(',') + '\n';
	});
	
	return csv;
}

function downloadCSV(content, filename) {
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	
	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

// ===== 错误处理 =====
function handleError(error) {
	let errorMsg = '生成失败';
	
	if (error.message.includes('timeout')) {
		errorMsg = '操作超时，请稍后重试';
	} else if (error.message.includes('network') || error.message.includes('fetch')) {
		errorMsg = '网络连接异常，请检查网络';
	} else if (error.message.includes('permission') || error.message.includes('access')) {
		errorMsg = '权限不足，请检查Eagle库访问权限';
	} else if (error.message.includes('undefined') || error.message.includes('null')) {
		errorMsg = '数据格式异常，请检查Eagle库数据完整性';
	} else if (error.message) {
		errorMsg = error.message;
	}
	
	addStatusMessage(`❌ ${errorMsg}`, 'error');
	
	// 提供故障排查建议
	if (error.message.includes('timeout')) {
		addStatusMessage('💡 建议：减少筛选范围或稍后重试', 'info');
	} else if (error.message.includes('permission')) {
		addStatusMessage('💡 建议：重启Eagle应用或检查插件权限', 'info');
	}
}

// ===== 超时控制 =====
function withTimeout(promise, ms = 30000) {
	return Promise.race([
		promise,
		new Promise((_, reject) => 
			setTimeout(() => reject(new Error(`操作超时（${ms/1000}秒）`)), ms)
		)
	]);
}

// ===== 主函数：生成报告 =====
async function generateReport() {
	const btn = document.querySelector('#generateBtn');
	btn.disabled = true;
	btn.textContent = '生成中...';
	
	const startTime = Date.now();
	
	try {
		hidePreview();
		showProgress();
		addStatusMessage('开始生成报告...', 'info');
		
		// 构建文件夹缓存
		updateProgress(10, '加载文件夹信息...');
		addStatusMessage('正在加载文件夹信息...', 'info');
		await buildFolderCache();
		
		// 获取筛选条件
		const selectedPerson = document.querySelector('#personSelect').value;
		const projectFilter = document.querySelector('#projectFilter').value.trim().toLowerCase();
		const keywordFilter = document.querySelector('#keywordFilter').value.trim().toLowerCase();
		const enableDateFilter = document.querySelector('#enableDateFilter').checked;
		
		// 文件类型筛选
		const fileTypeFilters = {
			image: document.querySelector('#filterImage').checked,
			video: document.querySelector('#filterVideo').checked,
			document: document.querySelector('#filterDocument').checked,
			other: document.querySelector('#filterOther').checked
		};
		
		let dateRange = null;
		if (enableDateFilter) {
			const startYear = document.querySelector('#startYear').value;
			const startMonth = document.querySelector('#startMonth').value;
			const endYear = document.querySelector('#endYear').value;
			const endMonth = document.querySelector('#endMonth').value;
			dateRange = {
				start: startYear + startMonth,
				end: endYear + endMonth,
				text: `${startYear}年${parseInt(startMonth)}月 - ${endYear}年${parseInt(endMonth)}月`
			};
			addStatusMessage(`时间范围: ${dateRange.text}`, 'info');
		}
		
		// 显示筛选条件
		if (selectedPerson !== 'all') {
			addStatusMessage(`人员筛选: ${selectedPerson}`, 'info');
		}
		if (projectFilter) {
			addStatusMessage(`项目筛选: ${projectFilter}`, 'info');
		}
		if (keywordFilter) {
			addStatusMessage(`关键词: ${keywordFilter}`, 'info');
		}
		
		// 获取所有素材
		updateProgress(30, '获取素材数据...');
		addStatusMessage('正在获取素材数据...', 'info');
		const allItems = await eagle.item.getAll();
		
		if (!allItems?.length) {
			addStatusMessage('⚠️ 未找到任何素材', 'error');
			hideProgress();
			return;
		}
		
		addStatusMessage(`✓ 获取到 ${allItems.length} 个素材`, 'success');
		
		// 处理数据
		updateProgress(50, '处理数据中...');
		addStatusMessage('正在处理数据...', 'info');
		const reportData = [];
		const stats = { persons: {}, projects: {} };
		
		let processedCount = 0;
		
		for (const item of allItems) {
			processedCount++;
			// 更新进度（50%-80%区间）
			if (processedCount % 10 === 0) {
				const progress = 50 + Math.floor((processedCount / allItems.length) * 30);
				updateProgress(progress, `处理中 ${processedCount}/${allItems.length}`);
			}
			
			// 获取文件夹路径
			const folderPath = item.folders?.[0] ? getFolderPath(item.folders[0]) : '';
			const person = extractPersonFromPath(folderPath);
			const month = extractMonthFromPath(folderPath);
			
			// 人员筛选
			if (selectedPerson !== 'all' && person !== selectedPerson) continue;
			
			// 时间范围筛选
			if (dateRange) {
				const yearMonth = extractYearMonth(folderPath);
				if (!isInDateRange(yearMonth, dateRange.start, dateRange.end)) continue;
			}
			
			// 文件类型筛选
			const fileExt = item.ext;
			const itemFileType = getFileType(fileExt);
			if (!fileTypeFilters[itemFileType]) continue;
			
			// 提取项目信息
			let projectName = '未分类项目';
			let completionDate = '';
			
			if (item.tags?.[0]) {
				const parts = item.tags[0].split('·');
				projectName = parts.length > 1 ? parts[1] : parts[0];
				completionDate = extractDateFromTag(item.tags[0]);
			}
			
			// 项目名称筛选
			if (projectFilter && !projectName.toLowerCase().includes(projectFilter)) continue;
			
			// 关键词搜索（需求名称、标签、注释）
			if (keywordFilter) {
				const searchText = [
					item.name || '',
					item.tags?.join(' ') || '',
					item.annotation || ''
				].join(' ').toLowerCase();
				
				if (!searchText.includes(keywordFilter)) continue;
			}
			
			// 统计
			stats.persons[person] = (stats.persons[person] || 0) + 1;
			if (!stats.projects[projectName]) {
				stats.projects[projectName] = { count: 0, months: new Set() };
			}
			stats.projects[projectName].count++;
			stats.projects[projectName].months.add(month);
			
			// 添加数据
			reportData.push({
				人员: person,
				项目名称: projectName,
				需求名称: item.name || '未命名',
				完成时间: completionDate,
				月份分类: month,
				标签: item.tags?.join(', ') || '',
				注释: item.annotation || ''
			});
		}
		
		updateProgress(80, '生成统计信息...');
		
		if (!reportData.length) {
			addStatusMessage('⚠️ 未找到符合条件的数据', 'error');
			hideProgress();
			return;
		}
		
		// 显示数据预览
		showPreview(reportData.length, allItems.length);
		addStatusMessage(`✓ 筛选出 ${reportData.length} 条记录`, 'success');
		
		// 显示统计
		let statsMsg = '\n📊 统计信息：\n\n👤 人员统计：\n';
		Object.entries(stats.persons).forEach(([name, count]) => {
			statsMsg += `  • ${name}: ${count} 个需求\n`;
		});
		
		statsMsg += '\n📁 项目统计：\n';
		Object.entries(stats.projects).forEach(([name, data]) => {
			statsMsg += `  • ${name}: ${data.count} 个需求, ${data.months.size} 个月份\n`;
		});
		addStatusMessage(statsMsg, 'success');
		
		// 生成并下载CSV
		updateProgress(90, '生成CSV文件...');
		addStatusMessage('正在生成CSV文件...', 'info');
		const csv = generateCSV(reportData);
		
		const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
		const personPart = selectedPerson !== 'all' ? `_${selectedPerson}` : '';
		const datePart = dateRange ? `_${dateRange.start}-${dateRange.end}` : '';
		const filename = `项目时间报告${personPart}${datePart}_${timestamp}.csv`;
		
		updateProgress(100, '完成！');
		downloadCSV(csv, filename);
		addStatusMessage(`✅ 报告生成成功！文件名：${filename}`, 'success');
		
		// 保存用户选择
		saveUserPreferences();
		
	} catch (error) {
		console.error('生成报告出错:', error);
		addStatusMessage(`❌ 生成失败: ${error.message}`, 'error');
		hideProgress();
	} finally {
		btn.disabled = false;
		btn.textContent = '生成报告';
		setTimeout(hideProgress, 2000); // 2秒后隐藏进度条
	}
}

// ===== 进度条管理 =====
function showProgress() {
	document.querySelector('#progressContainer').style.display = 'block';
}

function hideProgress() {
	document.querySelector('#progressContainer').style.display = 'none';
	updateProgress(0);
}

function updateProgress(percent, text = '') {
	const fill = document.querySelector('#progressFill');
	const textEl = document.querySelector('#progressText');
	fill.style.width = percent + '%';
	textEl.textContent = text || `${Math.round(percent)}%`;
}

// ===== 数据预览 =====
function showPreview(filteredCount, totalCount) {
	const previewDiv = document.querySelector('#previewInfo');
	const previewText = document.querySelector('#previewText');
	previewText.textContent = ` 符合筛选条件：${filteredCount} / ${totalCount} 条记录`;
	previewDiv.style.display = 'block';
}

function hidePreview() {
	document.querySelector('#previewInfo').style.display = 'none';
}

// ===== 快捷日期设置 =====
function setThisMonth() {
	const now = new Date();
	const year = now.getFullYear();
	const month = (now.getMonth() + 1).toString().padStart(2, '0');
	
	document.querySelector('#startYear').value = year;
	document.querySelector('#startMonth').value = month;
	document.querySelector('#endYear').value = year;
	document.querySelector('#endMonth').value = month;
	document.querySelector('#enableDateFilter').checked = true;
	
	addStatusMessage('✓ 已设置为本月', 'success');
}

function setLastMonth() {
	const now = new Date();
	now.setMonth(now.getMonth() - 1);
	const year = now.getFullYear();
	const month = (now.getMonth() + 1).toString().padStart(2, '0');
	
	document.querySelector('#startYear').value = year;
	document.querySelector('#startMonth').value = month;
	document.querySelector('#endYear').value = year;
	document.querySelector('#endMonth').value = month;
	document.querySelector('#enableDateFilter').checked = true;
	
	addStatusMessage('✓ 已设置为上月', 'success');
}

function setThisQuarter() {
	const now = new Date();
	const year = now.getFullYear();
	const currentMonth = now.getMonth();
	const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
	
	document.querySelector('#startYear').value = year;
	document.querySelector('#startMonth').value = (quarterStartMonth + 1).toString().padStart(2, '0');
	document.querySelector('#endYear').value = year;
	document.querySelector('#endMonth').value = (now.getMonth() + 1).toString().padStart(2, '0');
	document.querySelector('#enableDateFilter').checked = true;
	
	addStatusMessage('✓ 已设置为本季度', 'success');
}

function setThisYear() {
	const year = new Date().getFullYear();
	const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
	
	document.querySelector('#startYear').value = year;
	document.querySelector('#startMonth').value = '01';
	document.querySelector('#endYear').value = year;
	document.querySelector('#endMonth').value = currentMonth;
	document.querySelector('#enableDateFilter').checked = true;
	
	addStatusMessage('✓ 已设置为本年度', 'success');
}

// ===== localStorage管理 =====
function saveUserPreferences() {
	const prefs = {
		person: document.querySelector('#personSelect').value,
		projectFilter: document.querySelector('#projectFilter').value,
		keywordFilter: document.querySelector('#keywordFilter').value,
		enableDateFilter: document.querySelector('#enableDateFilter').checked,
		startYear: document.querySelector('#startYear').value,
		startMonth: document.querySelector('#startMonth').value,
		endYear: document.querySelector('#endYear').value,
		endMonth: document.querySelector('#endMonth').value,
		filterImage: document.querySelector('#filterImage').checked,
		filterVideo: document.querySelector('#filterVideo').checked,
		filterDocument: document.querySelector('#filterDocument').checked,
		filterOther: document.querySelector('#filterOther').checked
	};
	localStorage.setItem('reportPreferences', JSON.stringify(prefs));
}

function loadUserPreferences() {
	const saved = localStorage.getItem('reportPreferences');
	if (saved) {
		try {
			const prefs = JSON.parse(saved);
			document.querySelector('#personSelect').value = prefs.person || 'all';
			document.querySelector('#projectFilter').value = prefs.projectFilter || '';
			document.querySelector('#keywordFilter').value = prefs.keywordFilter || '';
			document.querySelector('#enableDateFilter').checked = prefs.enableDateFilter || false;
			if (prefs.startYear) document.querySelector('#startYear').value = prefs.startYear;
			if (prefs.startMonth) document.querySelector('#startMonth').value = prefs.startMonth;
			if (prefs.endYear) document.querySelector('#endYear').value = prefs.endYear;
			if (prefs.endMonth) document.querySelector('#endMonth').value = prefs.endMonth;
			
			// 恢复文件类型筛选
			if (prefs.filterImage !== undefined) document.querySelector('#filterImage').checked = prefs.filterImage;
			if (prefs.filterVideo !== undefined) document.querySelector('#filterVideo').checked = prefs.filterVideo;
			if (prefs.filterDocument !== undefined) document.querySelector('#filterDocument').checked = prefs.filterDocument;
			if (prefs.filterOther !== undefined) document.querySelector('#filterOther').checked = prefs.filterOther;
			
			addStatusMessage('✓ 已恢复上次的筛选设置', 'info');
		} catch (e) {
			console.error('加载用户偏好失败:', e);
		}
	}
}

// ===== 初始化 =====
function initYearSelectors() {
	const currentYear = new Date().getFullYear();
	const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
	
	['startYear', 'endYear'].forEach(id => {
		const select = document.querySelector(`#${id}`);
		for (let year = 2020; year <= currentYear + 1; year++) {
			const option = document.createElement('option');
			option.value = year;
			option.textContent = year + '年';
			if (year === currentYear) option.selected = true;
			select.appendChild(option);
		}
	});
	
	document.querySelector('#startMonth').value = '01';
	document.querySelector('#endMonth').value = currentMonth;
}

function initEventListeners() {
	// 筛选条件变化时保存
	const saveOnChangeIds = [
		'personSelect', 'projectFilter', 'keywordFilter', 
		'enableDateFilter', 'startYear', 'startMonth', 'endYear', 'endMonth',
		'filterImage', 'filterVideo', 'filterDocument', 'filterOther'
	];
	
	saveOnChangeIds.forEach(id => {
		const el = document.querySelector(`#${id}`);
		if (el) {
			const eventType = el.tagName === 'INPUT' && el.type === 'text' ? 'blur' : 'change';
			el.addEventListener(eventType, saveUserPreferences);
		}
	});
}

eagle.onPluginCreate((plugin) => {
	addStatusMessage(`插件已加载 - ${plugin.manifest.name} v${plugin.manifest.version}`, 'info');
	initYearSelectors();
	loadUserPreferences();
	initEventListeners();
	document.querySelector('#generateBtn').addEventListener('click', generateReport);
});

eagle.onPluginRun(() => console.log('Plugin Run'));
eagle.onPluginShow(() => console.log('Plugin Show'));
eagle.onPluginHide(() => console.log('Plugin Hide'));
eagle.onPluginBeforeExit(() => console.log('Plugin Exit'));
