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

// ===== 从添加日期提取信息 =====
function extractMonthFromAddDate(timestamp) {
	if (!timestamp) return '未分类';
	try {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		return `${year}年${month}月`;
	} catch (e) {
		console.error('日期解析失败:', e);
		return '未分类';
	}
}

function extractYearMonthFromAddDate(timestamp) {
	if (!timestamp) return null;
	try {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		return year + month;
	} catch (e) {
		console.error('日期解析失败:', e);
		return null;
	}
}

function formatAddDate(timestamp) {
	if (!timestamp) return '';
	try {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		return `${year}-${month}-${day}`;
	} catch (e) {
		console.error('日期格式化失败:', e);
		return '';
	}
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

// ===== Excel生成（带缩略图）=====
async function generateExcel(data, filename) {
	try {
		addStatusMessage('正在创建Excel工作簿...', 'info');
		
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet('项目报告');
		
		// 定义列
		worksheet.columns = [
			{ header: '缩略图', key: 'thumbnail', width: 15 },
			{ header: '人员', key: 'person', width: 12 },
			{ header: '项目名称', key: 'projectName', width: 25 },
			{ header: '需求名称', key: 'requirementName', width: 30 },
			{ header: '完成时间', key: 'completionDate', width: 15 },
			{ header: '月份分类', key: 'monthCategory', width: 15 },
			{ header: '标签', key: 'tags', width: 30 },
			{ header: '注释', key: 'annotation', width: 30 }
		];
		
		// 设置表头样式
		worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
		worksheet.getRow(1).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF667EEA' }
		};
		worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
		worksheet.getRow(1).height = 25;
		
		addStatusMessage(`准备插入 ${data.length} 条记录...`, 'info');
		
		// 添加数据行
		for (let i = 0; i < data.length; i++) {
			const item = data[i];
			const rowIndex = i + 2; // 从第2行开始（第1行是表头）
			
			// 每10条记录更新一次进度
			if (i % 10 === 0) {
				const progress = 85 + Math.floor((i / data.length) * 10);
				updateProgress(progress, `生成Excel: ${i + 1}/${data.length}`);
			}
			
			// 添加数据行
			const row = worksheet.addRow({
				thumbnail: '', // 缩略图单元格留空，后面用图片填充
				person: item.人员,
				projectName: item.项目名称,
				requirementName: item.需求名称,
				completionDate: item.完成时间,
				monthCategory: item.月份分类,
				tags: item.标签,
				annotation: item.注释
			});
			
			// 设置行高
			row.height = 80;
			row.alignment = { vertical: 'middle', wrapText: true };
			
			// 插入缩略图
			if (item.item) {
				try {
					const imageBuffer = await loadImageAsBuffer(item.item);
					if (imageBuffer) {
						const imageId = workbook.addImage({
							buffer: imageBuffer,
							extension: 'png' // Eagle缩略图都是PNG格式
						});
						
						// 将图片添加到单元格
						worksheet.addImage(imageId, {
							tl: { col: 0, row: rowIndex - 1 }, // top-left
							ext: { width: 80, height: 80 },
							editAs: 'oneCell'
						});
					}
				} catch (imgError) {
					console.warn(`图片加载失败 (${item.需求名称}):`, imgError);
					// 图片加载失败时，在单元格中显示文字说明
					worksheet.getCell(rowIndex, 1).value = '无缩略图';
				}
			}
		}
		
		// 设置边框
		worksheet.eachRow((row, rowNumber) => {
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
					left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
					bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
					right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
				};
			});
		});
		
		updateProgress(95, '保存Excel文件...');
		addStatusMessage('正在保存Excel文件...', 'info');
		
		// 生成文件
		const buffer = await workbook.xlsx.writeBuffer();
		downloadBlob(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		
		return true;
	} catch (error) {
		console.error('生成Excel失败:', error);
		throw new Error(`Excel生成失败: ${error.message}`);
	}
}

// ===== 图片处理函数 =====
async function loadImageAsBuffer(item) {
	try {
		// 从filePath提取库路径
		if (!item.filePath) {
			console.warn('素材没有filePath:', item.name);
			return null;
		}
		
		// filePath格式：\\\\192.168.1.220\某某\D_盘\美术部\Eagle 数据库\素材库.library\images\...
		// 需要提取到 .library 所在的目录
		let filePath = item.filePath;
		const libraryMatch = filePath.match(/(.+\.library)/i);
		
		if (!libraryMatch) {
			console.warn('无法从路径中提取库路径:', filePath);
			return null;
		}
		
		const libraryPath = libraryMatch[1];
		
		// Eagle缩略图实际存储路径：库路径\images\{itemId}.info\{原文件名}_thumbnail.png
		// 例如：素材库.library\images\MJB4Y4QJW8I2S.info\2025.122.18巅峰对决名片换皮x3_thumbnail.png
		let thumbnailPath = `${libraryPath}\\images\\${item.id}.info\\${item.name}_thumbnail.png`;
		
		// 转换为file协议URL（UNC路径需要特殊处理）
		if (thumbnailPath.startsWith('\\\\')) {
			// UNC路径：\\\\server\\share\\... 转换为 file://server/share/...
			// 移除前面的 \\\\ 然后添加 file:// 前缀
			thumbnailPath = 'file://' + thumbnailPath.substring(2).replace(/\\/g, '/');
		} else {
			// 本地路径：C:\\... 转换为 file:///C:/...
			thumbnailPath = 'file:///' + thumbnailPath.replace(/\\/g, '/');
		}
		
		console.log(`尝试加载缩略图: ${thumbnailPath}`);
		
		const response = await fetch(thumbnailPath);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	} catch (error) {
		console.error(`读取图片失败 (${item.name}):`, error);
		return null;
	}
}

function getImageExtension(path) {
	if (!path) return 'png';
	const ext = path.split('.').pop().toLowerCase();
	// ExcelJS支持的图片格式
	const validExts = ['png', 'jpeg', 'jpg', 'gif'];
	return validExts.includes(ext) ? (ext === 'jpg' ? 'jpeg' : ext) : 'png';
}

function downloadBlob(buffer, filename, mimeType) {
	const blob = new Blob([buffer], { type: mimeType });
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

// ===== CSV生成（保留作为备用）=====
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
		
		// 调试：输出第一个素材的时间字段
		if (allItems.length > 0) {
			console.log('第一个素材的时间字段:', {
				importedAt: allItems[0].importedAt,
				timestamp: new Date(allItems[0].importedAt),
				formatted: formatAddDate(allItems[0].importedAt)
			});
		}
		
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
			
			// 获取文件夹路径（用于提取人员信息）
			const folderPath = item.folders?.[0] ? getFolderPath(item.folders[0]) : '';
			const person = extractPersonFromPath(folderPath);
			
			// 从添加日期提取月份信息
			const month = extractMonthFromAddDate(item.importedAt);
			
			// 人员筛选
			if (selectedPerson !== 'all' && person !== selectedPerson) continue;
			
			// 时间范围筛选（使用添加日期）
			if (dateRange) {
				const yearMonth = extractYearMonthFromAddDate(item.importedAt);
				if (!isInDateRange(yearMonth, dateRange.start, dateRange.end)) continue;
			}
			
			// 文件类型筛选
			const fileExt = item.ext;
			const itemFileType = getFileType(fileExt);
			if (!fileTypeFilters[itemFileType]) continue;
			
			// 提取项目信息
			let projectName = '未分类项目';
			
			if (item.tags?.[0]) {
				const parts = item.tags[0].split('·');
				projectName = parts.length > 1 ? parts[1] : parts[0];
			}
			
			// 使用添加日期作为完成时间
			const completionDate = formatAddDate(item.importedAt);
			
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
			
			// 调试：输出前3条记录的素材ID信息
			if (reportData.length < 3) {
				console.log(`[调试] 素材 #${reportData.length + 1}:`, {
					id: item.id,
					name: item.name,
					thumbnail: item.thumbnail,
					filePath: item.filePath
				});
			}
			
			// 添加数据 - 保存完整的item对象用于加载缩略图
			reportData.push({
				item: { id: item.id, name: item.name, filePath: item.filePath }, // 保存关键信息
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
		
		// 生成并下载Excel文件（带缩略图）
		updateProgress(85, '生成Excel文件...');
		addStatusMessage('正在生成Excel文件...', 'info');
		
		const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
		const personPart = selectedPerson !== 'all' ? `_${selectedPerson}` : '';
		const datePart = dateRange ? `_${dateRange.start}-${dateRange.end}` : '';
		const filename = `项目时间报告${personPart}${datePart}_${timestamp}.xlsx`;
		
		await generateExcel(reportData, filename);
		
		updateProgress(100, '完成！');
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

async function initPersonSelector() {
	try {
		addStatusMessage('正在加载人员列表...', 'info');
		
		// 构建文件夹缓存
		await buildFolderCache();
		
		// 获取所有素材
		const allItems = await eagle.item.getAll();
		
		if (!allItems?.length) {
			addStatusMessage('⚠️ 未找到任何素材', 'error');
			return;
		}
		
		// 提取所有唯一的人员名称
		const personSet = new Set();
		allItems.forEach(item => {
			const folderPath = item.folders?.[0] ? getFolderPath(item.folders[0]) : '';
			const person = extractPersonFromPath(folderPath);
			if (person && person !== '未知') {
				personSet.add(person);
			}
		});
		
		// 将人员名称排序
		const persons = Array.from(personSet).sort();
		
		// 填充到下拉列表
		const personSelect = document.querySelector('#personSelect');
		// 保留"全部人员"选项
		const allOption = personSelect.querySelector('option[value="all"]');
		personSelect.innerHTML = '';
		personSelect.appendChild(allOption);
		
		// 添加人员选项
		persons.forEach(person => {
			const option = document.createElement('option');
			option.value = person;
			option.textContent = person;
			personSelect.appendChild(option);
		});
		
		addStatusMessage(`✓ 已加载 ${persons.length} 个人员`, 'success');
		
	} catch (error) {
		console.error('加载人员列表失败:', error);
		addStatusMessage('⚠️ 加载人员列表失败，请刷新插件重试', 'error');
	}
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

eagle.onPluginCreate(async (plugin) => {
	addStatusMessage(`插件已加载 - ${plugin.manifest.name} v${plugin.manifest.version}`, 'info');
	initYearSelectors();
	initEventListeners();
	
	// 动态加载人员列表
	await initPersonSelector();
	
	// 加载用户偏好（在人员列表加载后）
	loadUserPreferences();
	
	document.querySelector('#generateBtn').addEventListener('click', generateReport);
});

eagle.onPluginRun(() => console.log('Plugin Run'));
eagle.onPluginShow(() => console.log('Plugin Show'));
eagle.onPluginHide(() => console.log('Plugin Hide'));
eagle.onPluginBeforeExit(() => console.log('Plugin Exit'));
