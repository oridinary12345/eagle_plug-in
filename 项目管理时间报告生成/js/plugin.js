// 状态消息管理
function addStatusMessage(message, type = 'info') {
	const statusDiv = document.querySelector('#statusMessage');
	const timestamp = new Date().toLocaleTimeString('zh-CN');
	
	// 移除空状态
	if (statusDiv.classList.contains('empty-state')) {
		statusDiv.classList.remove('empty-state');
		statusDiv.innerHTML = '';
	}
	
	const messageDiv = document.createElement('div');
	messageDiv.className = `status-item ${type}`;
	messageDiv.innerHTML = `
		<span class="timestamp">[${timestamp}]</span>
		<span>${message}</span>
	`;
	
	statusDiv.appendChild(messageDiv);
	
	// 自动滚动到底部
	const statusArea = document.querySelector('.status-area');
	statusArea.scrollTop = statusArea.scrollHeight;
}

// 清空状态消息
function clearStatus() {
	const statusDiv = document.querySelector('#statusMessage');
	statusDiv.innerHTML = '<div class="empty-state">点击上方按钮生成报告...</div>';
	statusDiv.className = 'empty-state';
}

// 解析日期字符串
function parseDate(dateStr) {
	if (!dateStr) return null;
	
	// 支持多种日期格式
	const formats = [
		/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/,  // 2024-09-26 or 2024.09.26
		/(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})/,  // 09-26-2024 or 26-09-2024
		/(\d{1,2})月(\d{1,2})日/,                  // 9月26日
	];
	
	for (let format of formats) {
		const match = dateStr.match(format);
		if (match) {
			return match[0];
		}
	}
	
	return dateStr;
}

// 从标签中提取日期
function extractDateFromTag(tag) {
	const dateMatch = tag.match(/(\d{1,2})\.(\d{1,2})/);
	if (dateMatch) {
		const month = dateMatch[1].padStart(2, '0');
		const day = dateMatch[2].padStart(2, '0');
		const year = new Date().getFullYear();
		return `${year}-${month}-${day}`;
	}
	return null;
}

// 文件夹路径缓存
let folderPathCache = {};

// 构建文件夹路径（递归遍历children）
function buildFolderPath(folder, parentPath = '') {
	const currentPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
	folderPathCache[folder.id] = currentPath;
	
	if (folder.children && folder.children.length > 0) {
		for (const child of folder.children) {
			buildFolderPath(child, currentPath);
		}
	}
}

// 初始化文件夹路径缓存
async function initFolderCache() {
	console.log('正在构建文件夹路径缓存...');
	folderPathCache = {};
	
	try {
		const allFolders = await eagle.folder.getAll();
		console.log(`获取到 ${allFolders.length} 个文件夹`);
		
		// 找到所有根文件夹（没有parent的）
		for (const folder of allFolders) {
			if (!folder.parent) {
				buildFolderPath(folder);
			}
		}
		
		console.log('文件夹路径缓存：', folderPathCache);
	} catch (e) {
		console.log('构建文件夹缓存失败：', e);
	}
}

// 从缓存获取文件夹路径
function getFolderPath(folderId) {
	return folderPathCache[folderId] || null;
}

// 从Eagle文件夹路径提取人员名称
function extractPersonFromPath(folderPath) {
	if (!folderPath) return '未知';
	
	// 文件夹结构: 人员名/年份/季度/月份
	// 例如: 梁嘉雄/2025/2025_下半年/2025_09
	const parts = folderPath.split('/');
	
	// 第一层是人员名称
	if (parts.length > 0) {
		return parts[0].trim();
	}
	
	return '未知';
}

// 从Eagle文件夹路径提取月份并格式化为中文
function extractMonthFromPath(folderPath) {
	if (!folderPath) return '未分类';
	
	const parts = folderPath.split('/');
	
	// 找到月份格式 (如 2025_09)
	for (const part of parts) {
		if (/^\d{4}_\d{2}$/.test(part)) {
			// 转换为中文格式: 2025_09 -> 2025年9月
			const [year, month] = part.split('_');
			return `${year}年${parseInt(month)}月`;
		}
	}
	
	// 如果没找到标准格式，尝试其他格式
	for (const part of parts) {
		// 匹配 2025年9月 这样的格式
		if (/\d{4}年\d{1,2}月/.test(part)) {
			return part;
		}
		// 匹配 2025-09 这样的格式
		if (/^\d{4}-\d{2}$/.test(part)) {
			const [year, month] = part.split('-');
			return `${year}年${parseInt(month)}月`;
		}
	}
	
	// 返回最后一层文件夹名
	return parts[parts.length - 1] || '未分类';
}

// 生成报告
async function generateReport() {
	const button = document.querySelector('#generateBtn');
	button.disabled = true;
	button.textContent = '生成中...';
	
	try {
		addStatusMessage('开始生成项目时间报告...', 'info');
		
		// 初始化文件夹路径缓存
		addStatusMessage('正在构建文件夹路径索引...', 'info');
		await initFolderCache();
		addStatusMessage('✓ 文件夹路径索引构建完成', 'success');
		
		// 获取选择的人员
		const selectedPerson = document.querySelector('#personSelect').value;
		if (selectedPerson !== 'all') {
			addStatusMessage(`筛选人员：${selectedPerson}`, 'info');
		} else {
			addStatusMessage('获取全部人员数据', 'info');
		}
		
		// 获取日期范围筛选设置
		const enableDateFilter = document.querySelector('#enableDateFilter').checked;
		let startYear, startMonth, endYear, endMonth;
		if (enableDateFilter) {
			startYear = document.querySelector('#startYear').value;
			startMonth = document.querySelector('#startMonth').value;
			endYear = document.querySelector('#endYear').value;
			endMonth = document.querySelector('#endMonth').value;
			addStatusMessage(`时间范围：${startYear}年${parseInt(startMonth)}月 至 ${endYear}年${parseInt(endMonth)}月`, 'info');
		}
		
		// 获取库中的所有素材
		addStatusMessage('正在获取素材数据...', 'info');
		const allItems = await eagle.item.getAll();
		
		if (!allItems || allItems.length === 0) {
			addStatusMessage('⚠️ 未找到任何素材', 'error');
			return;
		}
		
		addStatusMessage(`✓ 已获取 ${allItems.length} 个素材`, 'success');
		
		// 解析数据
		addStatusMessage('正在解析素材数据...', 'info');
		const reportData = [];
		const projectStats = {};
		const personStats = {};
		
		for (let i = 0; i < allItems.length; i++) {
			const item = allItems[i];
			
			// 调试：输出前几个素材的详细信息（在处理之前）
			if (i < 3) {
				console.log(`素材 ${i + 1} 原始信息：`, {
					name: item.name,
					tags: item.tags,
					folders: item.folders,
					annotation: item.annotation
				});
				addStatusMessage(`[调试 ${i + 1}] 素材: ${item.name}`, 'info');
				addStatusMessage(`  文件夹ID: ${item.folders ? item.folders.join(', ') : '无'}`, 'info');
			}
			
			// 获取文件夹路径
			let folderPath = null;
			if (item.folders && item.folders.length > 0) {
				if (i < 3) {
					addStatusMessage(`  正在获取文件夹路径...`, 'info');
				}
				folderPath = await getFolderPath(item.folders[0]);
				if (i < 3) {
					console.log(`文件夹路径结果：`, folderPath);
					addStatusMessage(`  文件夹路径: "${folderPath || '获取失败'}"`, 'info');
					
					// 显示提取结果
					const person = extractPersonFromPath(folderPath);
					const month = extractMonthFromPath(folderPath);
					addStatusMessage(`  提取人员: "${person}"`, 'info');
					addStatusMessage(`  提取月份: "${month}"`, 'info');
				}
			}
			
			// 提取人员名称（从文件夹路径）
			const personName = extractPersonFromPath(folderPath);
			
			// 如果选择了特定人员，跳过其他人员的素材
			if (selectedPerson !== 'all' && personName !== selectedPerson) {
				continue;
			}
			
			// 如果启用了日期筛选，检查是否在日期范围内
			if (enableDateFilter) {
				const itemYearMonth = extractYearMonthFromPath(folderPath);
				if (!itemYearMonth || !isDateInRange(itemYearMonth, startYear, startMonth, endYear, endMonth)) {
					continue;
				}
			}
			
			// 提取项目名称（从标签中）
			let projectName = '未分类项目';
			let completionDate = '';
			
			if (item.tags && item.tags.length > 0) {
				// 从第一个标签提取项目信息和日期
				const firstTag = item.tags[0];
				const tagParts = firstTag.split('·');
				if (tagParts.length > 1) {
					projectName = tagParts[1];
				} else {
					projectName = firstTag;
				}
				completionDate = extractDateFromTag(firstTag) || '';
			}
			
			// 从annotation提取时间信息
			if (item.annotation) {
				const dateInAnnotation = parseDate(item.annotation);
				if (dateInAnnotation && !completionDate) {
					completionDate = dateInAnnotation;
				}
			}
			
			// 获取文件夹作为月份分类
			const monthFolder = extractMonthFromPath(folderPath);
			
			// 需求名称（素材标题）
			const requirementName = item.name || '未命名需求';
			
			// 统计项目信息
			if (!projectStats[projectName]) {
				projectStats[projectName] = {
					count: 0,
					folders: new Set()
				};
			}
			projectStats[projectName].count++;
			projectStats[projectName].folders.add(monthFolder);
			
			// 统计人员信息
			if (!personStats[personName]) {
				personStats[personName] = 0;
			}
			personStats[personName]++;
			
			// 添加到报告数据
			reportData.push({
				人员: personName,
				项目名称: projectName,
				需求名称: requirementName,
				完成时间: completionDate,
				月份分类: monthFolder,
				标签: item.tags ? item.tags.join(', ') : '',
				注释: item.annotation || '',
				文件路径: item.filePath || ''
			});
		}
		
		if (reportData.length === 0) {
			addStatusMessage(`⚠️ 没有找到${selectedPerson}的数据`, 'error');
			return;
		}
		
		addStatusMessage(`✓ 解析完成，共 ${reportData.length} 条记录`, 'success');
		
		// 生成CSV
		addStatusMessage('正在生成CSV文件...', 'info');
		const csvContent = generateCSV(reportData);
		
		// 显示统计信息
		let statsMessage = '\n📊 统计信息：\n';
		statsMessage += '\n👤 人员统计：\n';
		for (const [person, count] of Object.entries(personStats)) {
			statsMessage += `• ${person}: ${count} 个需求\n`;
		}
		
		statsMessage += '\n📁 项目统计：\n';
		for (const [projectName, stats] of Object.entries(projectStats)) {
			statsMessage += `• ${projectName}: ${stats.count} 个需求，涉及 ${stats.folders.size} 个月份\n`;
		}
		addStatusMessage(statsMessage, 'success');
		
		// 保存文件 - 使用不同的方式
		addStatusMessage('正在准备下载文件...', 'info');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const personSuffix = selectedPerson !== 'all' ? `_${selectedPerson}` : '';
		const dateSuffix = enableDateFilter ? `_${startYear}${startMonth}-${endYear}${endMonth}` : '';
		const defaultFileName = `项目时间报告${personSuffix}${dateSuffix}_${timestamp}.csv`;
		
		// 创建下载
		downloadCSV(csvContent, defaultFileName);
		addStatusMessage(`✅ 报告已生成，文件名：${defaultFileName}`, 'success');
		
	} catch (error) {
		console.error('生成报告时出错：', error);
		addStatusMessage(`❌ 生成失败：${error.message}`, 'error');
		addStatusMessage(`详细错误：${error.stack}`, 'error');
	} finally {
		button.disabled = false;
		button.textContent = '生成报告';
	}
}

// 下载CSV文件
function downloadCSV(content, filename) {
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);
	
	link.setAttribute('href', url);
	link.setAttribute('download', filename);
	link.style.visibility = 'hidden';
	
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	
	URL.revokeObjectURL(url);
}

// 生成CSV内容
function generateCSV(data) {
	if (data.length === 0) return '';
	
	// 获取表头
	const headers = Object.keys(data[0]);
	
	// 转义CSV字段
	const escapeCSV = (field) => {
		if (field === null || field === undefined) return '';
		const str = String(field);
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};
	
	// 生成CSV内容
	let csv = '\ufeff'; // UTF-8 BOM for Excel
	csv += headers.map(escapeCSV).join(',') + '\n';
	
	for (const row of data) {
		csv += headers.map(header => escapeCSV(row[header])).join(',') + '\n';
	}
	
	return csv;
}

// 初始化年份选择器
function initYearSelectors() {
	const currentYear = new Date().getFullYear();
	const startYear = 2020; // 可以根据需要调整起始年份
	
	const startYearSelect = document.querySelector('#startYear');
	const endYearSelect = document.querySelector('#endYear');
	
	// 生成年份选项
	for (let year = startYear; year <= currentYear + 1; year++) {
		const option1 = document.createElement('option');
		option1.value = year;
		option1.textContent = year + '年';
		startYearSelect.appendChild(option1);
		
		const option2 = document.createElement('option');
		option2.value = year;
		option2.textContent = year + '年';
		endYearSelect.appendChild(option2);
	}
	
	// 默认选择当前年份1月到当前年份当前月
	startYearSelect.value = currentYear;
	endYearSelect.value = currentYear;
	
	const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
	document.querySelector('#startMonth').value = '01';
	document.querySelector('#endMonth').value = currentMonth;
}

// 从文件夹路径提取年月（返回YYYYMM格式用于比较）
function extractYearMonthFromPath(folderPath) {
	if (!folderPath) return null;
	
	const parts = folderPath.split('/');
	
	// 找到月份格式 (如 2025_09)
	for (const part of parts) {
		if (/^\d{4}_\d{2}$/.test(part)) {
			// 转换为 YYYYMM 格式用于比较
			return part.replace('_', '');
		}
	}
	
	return null;
}

// 检查日期是否在指定范围内
function isDateInRange(yearMonth, startYear, startMonth, endYear, endMonth) {
	if (!yearMonth) return false;
	
	const dateValue = parseInt(yearMonth); // YYYYMM 格式
	const startValue = parseInt(startYear + startMonth); // YYYYMM
	const endValue = parseInt(endYear + endMonth); // YYYYMM
	
	return dateValue >= startValue && dateValue <= endValue;
}

eagle.onPluginCreate((plugin) => {
	console.log('eagle.onPluginCreate');
	console.log(plugin);
	
	// 初始化界面
	addStatusMessage(`插件已加载 - ${plugin.manifest.name} v${plugin.manifest.version}`, 'info');
	
	// 初始化年份选择器
	initYearSelectors();
	
	// 绑定按钮事件
	document.querySelector('#generateBtn').addEventListener('click', generateReport);
});

eagle.onPluginRun(() => {
	console.log('eagle.onPluginRun');
});

eagle.onPluginShow(() => {
	console.log('eagle.onPluginShow');
});

eagle.onPluginHide(() => {
	console.log('eagle.onPluginHide');
});

eagle.onPluginBeforeExit((event) => {
	console.log('eagle.onPluginBeforeExit');
});
