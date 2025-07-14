// EagleEye 官方插件最佳实践写法
eagle.onPluginCreate(async (plugin) => {
	const message = document.querySelector('#message');
	console.log('plugin.js loaded, message div:', message);
	message.innerHTML = `
	<ul>
		<li>id: ${plugin.manifest.id}</li>
		<li>version: ${plugin.manifest.version}</li>
		<li>name: ${plugin.manifest.name}</li>
		<li>logo: ${plugin.manifest.logo}</li>
		<li>path: ${plugin.path}</li>
	</ul>
	`;

	// 监听选中变化，自动刷新
	if (eagle.event && eagle.event.on) {
		eagle.event.on('selectionChanged', async () => {
			console.log('selectionChanged event triggered');
			await refreshSelectedImages();
		});
	}

	// 初始延迟获取，最大兼容
	setTimeout(() => {
		console.log('setTimeout: refreshSelectedImages');
		refreshSelectedImages();
	}, 300);
});

// 刷新选中图片，双重API兼容
async function refreshSelectedImages() {
	const message = document.querySelector('#message');
	const old = document.getElementById('selected-images');
	if (old) old.remove();

	let selectedItems = [];
	try {
		if (eagle.item && eagle.item.getSelected) {
			selectedItems = await eagle.item.getSelected();
			console.log('getSelected result:', selectedItems);
		}
		if ((!selectedItems || selectedItems.length === 0) && eagle.item && eagle.item.get) {
			selectedItems = await eagle.item.get({ isSelected: true });
			console.log('get({isSelected:true}) result:', selectedItems);
		}
	} catch (e) {
		console.error('API error:', e);
		message.innerHTML += `<div id="selected-images" style="color:red;">无法获取选中图片，API 兼容性异常：${e.message || e.toString()}</div>`;
		return;
	}
	showSelectedImages(selectedItems);
}

// 显示选中图片
function showSelectedImages(assets) {
	const message = document.querySelector('#message');
	const old = document.getElementById('selected-images');
	if (old) old.remove();

	let html = '<div id="selected-images">';
	if (assets && assets.length > 0) {
		html += '选中图片：<div style="display:flex;flex-wrap:wrap;gap:8px;">';
		assets.forEach(asset => {
			const imgSrc = asset.thumb || asset.preview || asset.path;
			html += `<div><img src="${imgSrc}" style="max-width:120px;max-height:120px;border:1px solid #ccc;border-radius:4px;" title="${asset.name || ''}"><div style="text-align:center;font-size:12px;color:#888;">${asset.name || ''}</div></div>`;
		});
		html += '</div>';
	} else {
		html += '当前未选中任何图片。';
	}
	html += '</div>';
	message.innerHTML += html;
}

eagle.onPluginRun(() => {
	console.log('eagle.onPluginRun');
	// Eagle 4.0+ 推荐 API：window.eagleExt
	if (window.eagleExt && window.eagleExt.getSelectedAssets) {
		window.eagleExt.getSelectedAssets().then((assets) => {
			showSelectedImages(assets);
		});
		// 监听选中变化，实时刷新
		if (window.eagleExt.onAssetsSelectChange) {
			window.eagleExt.onAssetsSelectChange((assets) => {
				clearSelectedImages();
				showSelectedImages(assets);
			});
		}
	} else if (eagle.assets && eagle.assets.getSelected) {
		eagle.assets.getSelected().then((assets) => {
			showSelectedImages(assets);
		});
	} else if (eagle.getSelectedAssets) {
		eagle.getSelectedAssets().then((assets) => {
			showSelectedImages(assets);
		});
	} else {
		document.querySelector('#message').innerHTML += '<div style="color:red;">无法获取选中图片，API 不兼容。</div>';
	}
});

// 清除已显示的图片
function clearSelectedImages() {
	const message = document.querySelector('#message');
	// 只保留最初的 manifest 信息（前一个 ul），移除后续内容
	if (message && message.children.length > 0) {
		while (message.children.length > 1) {
			message.removeChild(message.lastChild);
		}
	}
}

// 显示选中图片
function showSelectedImages(assets) {
	const message = document.querySelector('#message');
	if (!assets || assets.length === 0) {
		message.innerHTML += '<div>当前未选中任何图片。</div>';
		return;
	}
	let html = '<div>选中图片：</div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
	assets.forEach(asset => {
		// 优先显示 thumb 或 preview，否则用 path
		const imgSrc = asset.thumb || asset.preview || asset.path;
		html += `<div><img src="${imgSrc}" style="max-width:120px;max-height:120px;border:1px solid #ccc;border-radius:4px;" title="${asset.name || ''}"></div>`;
	});
	html += '</div>';
	message.innerHTML += html;
}

eagle.onPluginShow(() => {
	console.log('eagle.onPluginShow');
});

eagle.onPluginHide(() => {
	console.log('eagle.onPluginHide');
});

eagle.onPluginBeforeExit((event) => {
	console.log('eagle.onPluginBeforeExit');
});