console.log('脚本开始加载...');

const fs = require('fs');
const path = require('path');

class ImageViewer {
    constructor() {
        console.log('ImageViewer 构造函数开始');
        
        // 基本状态
        this.currentImages = [];
        this.currentIndex = 0;
        this.scale = 1;
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeed = 1.0;
        this.fps = 12;
        this.isLooping = false;
        
        // 精灵图模式 - 设为默认开启
        this.isSpriteMode = true;
        this.spriteFrames = [];
        this.originalImage = null;
        this.isOnionskinMode = false;
        
        // 默认精灵图配置
        this.spriteConfig = {
            cols: 4,
            rows: 4,
            startFrame: 0,
            endFrame: 15,
            direction: 'horizontal'
        };
        
        console.log('ImageViewer 构造函数完成');
    }

    init() {
        console.log('init 方法开始');
        try {
            this.initDefaultSettings();
            this.bindEvents();
            this.loadImages();
            console.log('init 方法完成');
        } catch (error) {
            console.error('init 方法出错:', error);
        }
    }

    initDefaultSettings() {
        // 设置精灵图模式为默认开启
        const spriteModeCheckbox = document.getElementById('sprite-mode');
        if (spriteModeCheckbox) {
            spriteModeCheckbox.checked = true;
        }
        
        // 设置默认配置值
        this.updateConfigInputs();
    }

    updateConfigInputs() {
        this.safeSetValue('sprite-cols', this.spriteConfig.cols);
        this.safeSetValue('sprite-rows', this.spriteConfig.rows);
        this.safeSetValue('start-frame', this.spriteConfig.startFrame);
        this.safeSetValue('end-frame', this.spriteConfig.endFrame);
        this.safeSetValue('read-direction', this.spriteConfig.direction);
    }

    safeSetValue(id, value) {
        try {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        } catch (error) {
            console.error(`设置 ${id} 值失败:`, error);
        }
    }

    // 详细分析项目结构
    analyzeItem(item, index) {
        console.log(`=== 分析项目 ${index} ===`);
        console.log('完整对象:', item);
        console.log('对象类型:', typeof item);
        
        if (item && typeof item === 'object') {
            console.log('对象属性列表:');
            for (let key in item) {
                try {
                    const value = item[key];
                    console.log(`  ${key}: ${typeof value} = ${value}`);
                } catch (error) {
                    console.log(`  ${key}: 访问失败 - ${error.message}`);
                }
            }
        }
        
        // 尝试常见的属性名
        const possiblePaths = [
            'filePath', 'path', 'url', 'src', 'file', 'location',
            'fullPath', 'absolutePath', 'localPath'
        ];
        
        const possibleExts = [
            'ext', 'extension', 'format', 'type', 'fileType',
            'mimeType', 'contentType'
        ];
        
        const possibleNames = [
            'name', 'filename', 'fileName', 'title', 'label'
        ];
        
        console.log('尝试查找路径属性:');
        for (const prop of possiblePaths) {
            try {
                if (item[prop]) {
                    console.log(`  发现路径属性 ${prop}: ${item[prop]}`);
                }
            } catch (error) {
                console.log(`  访问 ${prop} 失败: ${error.message}`);
            }
        }
        
        console.log('尝试查找扩展名属性:');
        for (const prop of possibleExts) {
            try {
                if (item[prop]) {
                    console.log(`  发现扩展名属性 ${prop}: ${item[prop]}`);
                }
            } catch (error) {
                console.log(`  访问 ${prop} 失败: ${error.message}`);
            }
        }
        
        console.log('尝试查找名称属性:');
        for (const prop of possibleNames) {
            try {
                if (item[prop]) {
                    console.log(`  发现名称属性 ${prop}: ${item[prop]}`);
                }
            } catch (error) {
                console.log(`  访问 ${prop} 失败: ${error.message}`);
            }
        }
    }

    // 智能提取项目信息
    extractItemInfo(item) {
        const info = {
            name: '',
            filePath: '',
            ext: '',
            width: 0,
            height: 0,
            isValid: false
        };
        
        if (!item || typeof item !== 'object') {
            return info;
        }
        
        try {
            // 尝试获取文件路径
            const pathProps = ['filePath', 'path', 'url', 'src', 'file', 'location', 'fullPath'];
            for (const prop of pathProps) {
                if (item[prop] && typeof item[prop] === 'string' && item[prop].length > 0) {
                    info.filePath = item[prop];
                    break;
                }
            }
            
            // 尝试获取文件名
            const nameProps = ['name', 'filename', 'fileName', 'title', 'label'];
            for (const prop of nameProps) {
                if (item[prop] && typeof item[prop] === 'string' && item[prop].length > 0) {
                    info.name = item[prop];
                    break;
                }
            }
            
            // 如果没有名称，从路径提取
            if (!info.name && info.filePath) {
                info.name = path.basename(info.filePath);
            }
            
            // 尝试获取扩展名
            const extProps = ['ext', 'extension', 'format', 'type', 'fileType'];
            for (const prop of extProps) {
                if (item[prop] && typeof item[prop] === 'string' && item[prop].length > 0) {
                    info.ext = item[prop].replace('.', '').toLowerCase();
                    break;
                }
            }
            
            // 如果没有扩展名，从文件名或路径提取
            if (!info.ext) {
                const filename = info.name || info.filePath || '';
                if (filename.includes('.')) {
                    info.ext = filename.split('.').pop().toLowerCase();
                }
            }
            
            // 尝试获取尺寸
            const widthProps = ['width', 'w', 'imageWidth'];
            const heightProps = ['height', 'h', 'imageHeight'];
            
            for (const prop of widthProps) {
                if (item[prop] && typeof item[prop] === 'number') {
                    info.width = item[prop];
                    break;
                }
            }
            
            for (const prop of heightProps) {
                if (item[prop] && typeof item[prop] === 'number') {
                    info.height = item[prop];
                    break;
                }
            }
            
            // 判断是否为有效图片
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tga', 'ico'];
            info.isValid = (info.name.length > 0 || info.filePath.length > 0) && 
                          (info.ext.length > 0 && imageExts.includes(info.ext));
            
            console.log('提取的信息:', info);
            return info;
            
        } catch (error) {
            console.error('提取项目信息失败:', error);
            return info;
        }
    }

    // 获取配置文件路径
    getConfigFilePath(imagePath) {
        try {
            if (!imagePath) {
                console.error('图片路径为空');
                return null;
            }
            
            const imageDir = path.dirname(imagePath);
            const imageName = path.basename(imagePath, path.extname(imagePath));
            const configFileName = `${imageName}_sprite_config.json`;
            const configPath = path.join(imageDir, configFileName);
            
            console.log('配置文件路径:', configPath);
            return configPath;
        } catch (error) {
            console.error('获取配置文件路径失败:', error);
            return null;
        }
    }

    // 保存配置到图片文件夹
    saveConfigToImageFolder() {
        try {
            if (!this.currentImages || this.currentImages.length === 0) {
                this.showError('没有图片可保存配置');
                return;
            }
            
            const currentItem = this.currentImages[this.currentIndex];
            if (!currentItem || !currentItem.filePath) {
                this.showError('当前图片路径无效');
                return;
            }
            
            const configPath = this.getConfigFilePath(currentItem.filePath);
            if (!configPath) {
                this.showError('无法确定配置文件路径');
                return;
            }
            
            // 创建配置对象
            const config = {
                spriteConfig: this.spriteConfig,
                timestamp: Date.now(),
                version: '1.0',
                imageName: currentItem.name || path.basename(currentItem.filePath),
                created: new Date().toISOString()
            };
            
            // 写入配置文件
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
            
            console.log('配置保存成功:', configPath);
            console.log('配置内容:', config);
            
            this.showSaveSuccess();
            
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showError('保存配置失败: ' + error.message);
        }
    }

    // 从图片文件夹加载配置
    loadConfigFromImageFolder() {
        try {
            if (!this.currentImages || this.currentImages.length === 0) {
                console.log('没有图片，无法加载配置');
                return false;
            }
            
            const currentItem = this.currentImages[this.currentIndex];
            if (!currentItem || !currentItem.filePath) {
                console.log('当前图片路径无效');
                return false;
            }
            
            const configPath = this.getConfigFilePath(currentItem.filePath);
            if (!configPath) {
                console.log('无法确定配置文件路径');
                return false;
            }
            
            // 检查配置文件是否存在
            if (!fs.existsSync(configPath)) {
                console.log('配置文件不存在:', configPath);
                return false;
            }
            
            // 读取配置文件
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            if (config.spriteConfig) {
                this.spriteConfig = config.spriteConfig;
                this.updateConfigInputs();
                console.log('配置加载成功:', config.spriteConfig);
                this.showConfigLoaded();
                return true;
            }
            
            console.log('配置文件格式错误');
            return false;
            
        } catch (error) {
            console.error('加载配置失败:', error);
            return false;
        }
    }

    showSaveSuccess() {
        const applyBtn = document.getElementById('apply-sprite-config');
        if (applyBtn) {
            const originalText = applyBtn.textContent;
            const originalColor = applyBtn.style.backgroundColor;
            
            applyBtn.textContent = '保存成功！';
            applyBtn.style.backgroundColor = '#00ff88';
            
            setTimeout(() => {
                applyBtn.textContent = originalText;
                applyBtn.style.backgroundColor = originalColor;
            }, 2000);
        }
    }

    showConfigLoaded() {
        const applyBtn = document.getElementById('apply-sprite-config');
        if (applyBtn) {
            const originalText = applyBtn.textContent;
            const originalColor = applyBtn.style.backgroundColor;
            
            applyBtn.textContent = '配置已加载';
            applyBtn.style.backgroundColor = '#0088ff';
            
            setTimeout(() => {
                applyBtn.textContent = originalText;
                applyBtn.style.backgroundColor = originalColor;
            }, 2000);
        }
    }

    bindEvents() {
        console.log('开始绑定事件');
        
        // 基本按钮
        this.safeBindButton('play-pause-btn', () => this.togglePlayPause());
        this.safeBindButton('stop-btn', () => this.stopPlayback());
        this.safeBindButton('loop-btn', () => this.toggleLoop());
        this.safeBindButton('onionskin-btn', () => this.toggleOnionskinMode());
        
        this.safeBindButton('first-btn', () => this.goToFirst());
        this.safeBindButton('prev-btn', () => this.previousImage());
        this.safeBindButton('next-btn', () => this.nextImage());
        this.safeBindButton('last-btn', () => this.goToLast());
        
        this.safeBindButton('zoom-in-btn', () => this.zoomIn());
        this.safeBindButton('zoom-out-btn', () => this.zoomOut());
        this.safeBindButton('reset-zoom-btn', () => this.resetZoom());
        this.safeBindButton('fullscreen-btn', () => this.toggleFullscreen());
        
        this.safeBindButton('apply-sprite-config', () => this.applySpriteConfigAndSave());
        this.safeBindButton('refresh-btn', () => this.loadImages());
        
        // 精灵图模式切换
        const spriteMode = document.getElementById('sprite-mode');
        if (spriteMode) {
            spriteMode.addEventListener('change', (e) => {
                this.isSpriteMode = e.target.checked;
                this.toggleSpriteMode();
            });
        }
        
        // 滑块
        this.safeBindSlider('speed-slider', (value) => {
            this.playSpeed = parseFloat(value);
            this.safeSetText('speed-value', this.playSpeed.toFixed(1) + 'x');
            if (this.isPlaying) {
                this.restartPlayback();
            }
        });
        
        this.safeBindSlider('fps-slider', (value) => {
            this.fps = parseInt(value);
            this.safeSetText('fps-value', this.fps + ' FPS');
            if (this.isPlaying) {
                this.restartPlayback();
            }
        });
        
        // 配置输入框实时更新
        this.bindConfigInputs();
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        console.log('事件绑定完成');
    }

    bindConfigInputs() {
        const configInputs = ['sprite-cols', 'sprite-rows', 'start-frame', 'end-frame', 'read-direction'];
        
        configInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => {
                    this.updateSpriteConfigFromInputs();
                });
            }
        });
    }

    updateSpriteConfigFromInputs() {
        try {
            this.spriteConfig = {
                cols: parseInt(this.getElementValue('sprite-cols', '4')),
                rows: parseInt(this.getElementValue('sprite-rows', '4')),
                startFrame: parseInt(this.getElementValue('start-frame', '0')),
                endFrame: parseInt(this.getElementValue('end-frame', '15')),
                direction: this.getElementValue('read-direction', 'horizontal')
            };
        } catch (error) {
            console.error('更新精灵图配置失败:', error);
        }
    }

    safeBindButton(id, callback) {
        try {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', callback);
            } else {
                console.warn(`按钮 ${id} 未找到`);
            }
        } catch (error) {
            console.error(`绑定按钮 ${id} 失败:`, error);
        }
    }

    safeBindSlider(id, callback) {
        try {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', (e) => callback(e.target.value));
            } else {
                console.warn(`滑块 ${id} 未找到`);
            }
        } catch (error) {
            console.error(`绑定滑块 ${id} 失败:`, error);
        }
    }

    safeSetText(id, text) {
        try {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = text || '';
            }
        } catch (error) {
            console.error(`设置文本 ${id} 失败:`, error);
        }
    }

    safeSetDisplay(id, display) {
        try {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = display;
            }
        } catch (error) {
            console.error(`设置显示状态 ${id} 失败:`, error);
        }
    }

    handleKeyDown(e) {
        try {
            switch(e.key) {
                case 'ArrowLeft':
                    this.previousImage();
                    break;
                case 'ArrowRight':
                    this.nextImage();
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'Home':
                    this.goToFirst();
                    break;
                case 'End':
                    this.goToLast();
                    break;
                case 's':
                case 'S':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveConfigToImageFolder();
                    }
                    break;
                case 'Escape':
                    if (this.isPlaying) {
                        this.stopPlayback();
                    }
                    break;
            }
        } catch (error) {
            console.error('处理键盘事件失败:', error);
        }
    }

    async loadImages() {
        try {
            console.log('开始加载图片');
            this.showLoading();
            this.stopPlayback();
            
            if (typeof eagle === 'undefined') {
                console.error('Eagle API 不可用');
                this.showError('Eagle API 不可用，请确保在 Eagle 环境中运行');
                return;
            }

            const selectedItems = await eagle.item.getSelected();
            console.log('获取到选中项目数量:', selectedItems ? selectedItems.length : 0);
            console.log('原始选中项目:', selectedItems);
            
            // 清空当前图片列表
            this.currentImages = [];
            
            if (selectedItems && Array.isArray(selectedItems) && selectedItems.length > 0) {
                console.log('开始分析每个项目:');
                
                for (let i = 0; i < selectedItems.length; i++) {
                    try {
                        const item = selectedItems[i];
                        console.log(`\n--- 处理项目 ${i + 1} ---`);
                        
                        // 详细分析项目结构
                        this.analyzeItem(item, i + 1);
                        
                        // 提取项目信息
                        const itemInfo = this.extractItemInfo(item);
                        
                        if (itemInfo.isValid) {
                            // 创建标准化的项目对象
                            const standardItem = {
                                name: itemInfo.name,
                                filePath: itemInfo.filePath,
                                ext: itemInfo.ext,
                                width: itemInfo.width,
                                height: itemInfo.height,
                                original: item  // 保留原始对象以备用
                            };
                            
                            this.currentImages.push(standardItem);
                            console.log(`✓ 项目 ${i + 1} 被接受:`, standardItem.name);
                        } else {
                            console.log(`✗ 项目 ${i + 1} 被拒绝: 不是有效图片`);
                        }
                        
                    } catch (error) {
                        console.error(`处理项目 ${i + 1} 时出错:`, error);
                    }
                }
            } else {
                console.log('没有选中项目或项目列表为空');
            }

            console.log('最终有效图片数量:', this.currentImages.length);
            console.log('有效图片列表:', this.currentImages);

            if (this.currentImages.length === 0) {
                console.log('没有有效图片，显示无选择状态');
                this.showNoSelection();
                return;
            }

            // 排序
            try {
                this.currentImages.sort((a, b) => {
                    const nameA = a.name || '';
                    const nameB = b.name || '';
                    return nameA.localeCompare(nameB);
                });
                console.log('图片排序完成');
            } catch (error) {
                console.error('排序失败:', error);
            }
            
            this.currentIndex = 0;
            
            // 尝试加载配置
            const hasConfig = this.loadConfigFromImageFolder();
            if (hasConfig) {
                console.log('加载了保存的配置');
            } else {
                console.log('使用默认配置');
                this.updateConfigInputs();
            }
            
            this.showViewer();
            
            if (this.isSpriteMode) {
                await this.loadSpriteFrames();
            } else {
                this.displayCurrentImage();
            }
            
        } catch (error) {
            console.error('加载图片失败:', error);
            this.showError('加载图片失败: ' + error.message);
        }
    }

    toggleSpriteMode() {
        console.log('切换精灵图模式:', this.isSpriteMode);
        
        if (this.isSpriteMode) {
            this.applySpriteConfig();
        } else {
            this.displayCurrentImage();
        }
    }

    applySpriteConfig() {
        try {
            console.log('应用精灵图配置');
            this.updateSpriteConfigFromInputs();
            
            const maxFrames = this.spriteConfig.cols * this.spriteConfig.rows - 1;
            const endFrameEl = document.getElementById('end-frame');
            if (endFrameEl) {
                endFrameEl.max = maxFrames;
                if (this.spriteConfig.endFrame > maxFrames) {
                    this.spriteConfig.endFrame = maxFrames;
                    endFrameEl.value = maxFrames;
                }
            }

            console.log('精灵图配置:', this.spriteConfig);

            if (this.isSpriteMode && this.currentImages.length > 0) {
                this.loadSpriteFrames();
            }
        } catch (error) {
            console.error('应用精灵图配置失败:', error);
        }
    }

    applySpriteConfigAndSave() {
        try {
            this.applySpriteConfig();
            this.saveConfigToImageFolder();
        } catch (error) {
            console.error('应用并保存配置失败:', error);
        }
    }

    getElementValue(id, defaultValue) {
        try {
            const element = document.getElementById(id);
            return element ? element.value : defaultValue;
        } catch (error) {
            console.error(`获取元素 ${id} 值失败:`, error);
            return defaultValue;
        }
    }

    async loadSpriteFrames() {
        try {
            if (!this.currentImages || this.currentImages.length === 0) return;

            const currentItem = this.currentImages[this.currentIndex];
            if (!currentItem || !currentItem.filePath) {
                console.error('当前图片或文件路径无效');
                return;
            }
            
            const filePath = currentItem.filePath;
            console.log('加载精灵图:', filePath);
            
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        console.log('精灵图加载成功, 尺寸:', img.width, 'x', img.height);
                        this.originalImage = img;
                        this.extractSpriteFrames(img);
                        this.displayCurrentFrame();
                        this.updateUI();
                        resolve();
                    } catch (error) {
                        console.error('处理精灵图失败:', error);
                        resolve();
                    }
                };
                img.onerror = () => {
                    console.error('精灵图加载失败:', filePath);
                    this.showError('精灵图加载失败');
                    resolve();
                };
                img.src = `file://${filePath}`;
            });
        } catch (error) {
            console.error('加载精灵图时出错:', error);
        }
    }

    extractSpriteFrames(img) {
        try {
            const { cols, rows, startFrame, endFrame, direction } = this.spriteConfig;
            const frameWidth = img.width / cols;
            const frameHeight = img.height / rows;
            
            this.spriteFrames = [];

            for (let i = startFrame; i <= endFrame; i++) {
                let col, row;
                
                if (direction === 'horizontal') {
                    col = i % cols;
                    row = Math.floor(i / cols);
                } else {
                    row = i % rows;
                    col = Math.floor(i / rows);
                }
                
                if (row < rows && col < cols) {
                    this.spriteFrames.push({
                        x: col * frameWidth,
                        y: row * frameHeight,
                        width: frameWidth,
                        height: frameHeight,
                        index: i
                    });
                }
            }
            
            console.log('提取帧数:', this.spriteFrames.length);
        } catch (error) {
            console.error('提取精灵图帧失败:', error);
        }
    }

    displayCurrentFrame() {
        try {
            if (!this.spriteFrames || this.spriteFrames.length === 0) return;
            if (this.currentIndex >= this.spriteFrames.length) return;

            const frame = this.spriteFrames[this.currentIndex];
            const canvas = document.getElementById('main-canvas');
            const mainImage = document.getElementById('main-image');
            
            if (!canvas || !frame || !this.originalImage) return;
            
            const ctx = canvas.getContext('2d');
            
            canvas.width = frame.width;
            canvas.height = frame.height;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(
                this.originalImage,
                frame.x, frame.y, frame.width, frame.height,
                0, 0, frame.width, frame.height
            );
            
            canvas.style.display = 'block';
            if (mainImage) mainImage.style.display = 'none';

            this.updateUI();
        } catch (error) {
            console.error('显示当前帧失败:', error);
        }
    }

    displayCurrentImage() {
        try {
            if (!this.currentImages || this.currentImages.length === 0) return;
            if (this.currentIndex >= this.currentImages.length) return;

            const currentItem = this.currentImages[this.currentIndex];
            if (!currentItem || !currentItem.filePath) return;

            const imageElement = document.getElementById('main-image');
            const canvas = document.getElementById('main-canvas');
            const imageLoading = document.getElementById('image-loading');

            if (!imageElement) return;

            imageElement.style.display = 'block';
            if (canvas) canvas.style.display = 'none';

            if (imageLoading) imageLoading.style.display = 'flex';
            imageElement.style.opacity = '0.3';

            const filePath = currentItem.filePath;
            console.log('显示图片:', filePath);
            
            imageElement.src = `file://${filePath}`;
            
            imageElement.onload = () => {
                console.log('图片加载成功');
                if (imageLoading) imageLoading.style.display = 'none';
                imageElement.style.opacity = '1';
            };

            imageElement.onerror = () => {
                console.error('图片加载失败:', filePath);
                if (imageLoading) imageLoading.style.display = 'none';
                imageElement.style.opacity = '1';
                this.showError('图片加载失败');
            };

            this.updateUI();
        } catch (error) {
            console.error('显示当前图片失败:', error);
        }
    }

    updateUI() {
        try {
            const totalFrames = this.isSpriteMode ? 
                (this.spriteFrames ? this.spriteFrames.length : 0) : 
                (this.currentImages ? this.currentImages.length : 0);
            
            if (!this.currentImages || this.currentImages.length === 0) return;
            if (this.currentIndex >= this.currentImages.length) return;
            
            const currentItem = this.currentImages[this.currentIndex];
            if (!currentItem) return;
            
            this.safeSetText('current-frame', this.currentIndex + 1);
            this.safeSetText('total-frames', totalFrames);

            this.safeSetDisabled('prev-btn', this.currentIndex === 0);
            this.safeSetDisabled('next-btn', this.currentIndex === totalFrames - 1);
            this.safeSetDisabled('first-btn', this.currentIndex === 0);
            this.safeSetDisabled('last-btn', this.currentIndex === totalFrames - 1);

            const imageName = currentItem.name || path.basename(currentItem.filePath || '未知');
            this.safeSetText('image-name', imageName);
            
            if (this.isSpriteMode && this.spriteFrames && this.spriteFrames.length > 0 && this.currentIndex < this.spriteFrames.length) {
                const frame = this.spriteFrames[this.currentIndex];
                this.safeSetText('image-size', `${Math.round(frame.width)} × ${Math.round(frame.height)}`);
            } else {
                const width = currentItem.width || 0;
                const height = currentItem.height || 0;
                this.safeSetText('image-size', `${width} × ${height}`);
            }
        } catch (error) {
            console.error('更新UI失败:', error);
        }
    }

    safeSetDisabled(id, disabled) {
        try {
            const element = document.getElementById(id);
            if (element) element.disabled = disabled;
        } catch (error) {
            console.error(`设置按钮状态 ${id} 失败:`, error);
        }
    }

    // 播放控制方法
    togglePlayPause() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        try {
            const totalFrames = this.isSpriteMode ? 
                (this.spriteFrames ? this.spriteFrames.length : 0) : 
                (this.currentImages ? this.currentImages.length : 0);
                
            if (totalFrames <= 1) return;

            this.isPlaying = true;
            this.updatePlayButton();
            this.showPlayIndicator();

            const interval = (1000 / this.fps) / this.playSpeed;
            this.playInterval = setInterval(() => {
                this.nextFrame();
            }, interval);
        } catch (error) {
            console.error('开始播放失败:', error);
        }
    }

    pausePlayback() {
        try {
            this.isPlaying = false;
            this.updatePlayButton();
            this.hidePlayIndicator();
            
            if (this.playInterval) {
                clearInterval(this.playInterval);
                this.playInterval = null;
            }
        } catch (error) {
            console.error('暂停播放失败:', error);
        }
    }

    stopPlayback() {
        this.pausePlayback();
        this.currentIndex = 0;
        this.displayCurrentContent();
    }

    restartPlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
            this.startPlayback();
        }
    }

    nextFrame() {
        try {
            const totalFrames = this.isSpriteMode ? 
                (this.spriteFrames ? this.spriteFrames.length : 0) : 
                (this.currentImages ? this.currentImages.length : 0);
            
            if (this.currentIndex < totalFrames - 1) {
                this.currentIndex++;
            } else if (this.isLooping) {
                this.currentIndex = 0;
            } else {
                this.pausePlayback();
                return;
            }

            this.displayCurrentContent();
        } catch (error) {
            console.error('播放下一帧失败:', error);
        }
    }

    displayCurrentContent() {
        try {
            if (this.isSpriteMode) {
                this.displayCurrentFrame();
            } else {
                this.displayCurrentImage();
            }
        } catch (error) {
            console.error('显示当前内容失败:', error);
        }
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        const loopBtn = document.getElementById('loop-btn');
        if (loopBtn) {
            if (this.isLooping) {
                loopBtn.classList.add('active');
            } else {
                loopBtn.classList.remove('active');
            }
        }
    }

    toggleOnionskinMode() {
        this.isOnionskinMode = !this.isOnionskinMode;
        const btn = document.getElementById('onionskin-btn');
        
        if (this.isOnionskinMode) {
            if (btn) btn.classList.add('active');
        } else {
            if (btn) btn.classList.remove('active');
        }
        
        if (this.isSpriteMode) {
            this.displayCurrentFrame();
        }
    }

    updatePlayButton() {
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');
        
        if (this.isPlaying) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
        } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
        }
    }

    showPlayIndicator() {
        this.safeSetDisplay('play-indicator', 'flex');
    }

    hidePlayIndicator() {
        this.safeSetDisplay('play-indicator', 'none');
    }

    goToFirst() {
        this.currentIndex = 0;
        this.displayCurrentContent();
    }

    goToLast() {
        const totalFrames = this.isSpriteMode ? 
            (this.spriteFrames ? this.spriteFrames.length : 0) : 
            (this.currentImages ? this.currentImages.length : 0);
        this.currentIndex = Math.max(0, totalFrames - 1);
        this.displayCurrentContent();
    }

    previousImage() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCurrentContent();
        }
    }

    nextImage() {
        const totalFrames = this.isSpriteMode ? 
            (this.spriteFrames ? this.spriteFrames.length : 0) : 
            (this.currentImages ? this.currentImages.length : 0);
        if (this.currentIndex < totalFrames - 1) {
            this.currentIndex++;
            this.displayCurrentContent();
        }
    }

    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 5);
        this.updateImageTransform();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.1);
        this.updateImageTransform();
    }

    resetZoom() {
        this.scale = 1;
        this.updateImageTransform();
    }

    updateImageTransform() {
        try {
            const image = document.getElementById('main-image');
            const canvas = document.getElementById('main-canvas');
            
            const transform = `scale(${this.scale})`;
            if (image) image.style.transform = transform;
            if (canvas) canvas.style.transform = transform;
        } catch (error) {
            console.error('更新图片变换失败:', error);
        }
    }

    toggleFullscreen() {
        // 简化全屏功能
        console.log('全屏功能暂未实现');
    }

    showLoading() {
        this.safeSetDisplay('loading', 'flex');
        this.safeSetDisplay('no-selection', 'none');
        this.safeSetDisplay('viewer', 'none');
    }

    showNoSelection() {
        this.safeSetDisplay('loading', 'none');
        this.safeSetDisplay('no-selection', 'flex');
        this.safeSetDisplay('viewer', 'none');
    }

    showViewer() {
        this.safeSetDisplay('loading', 'none');
        this.safeSetDisplay('no-selection', 'none');
        this.safeSetDisplay('viewer', 'flex');
    }

    showError(message) {
        console.error(message);
        alert(message);
    }
}

console.log('ImageViewer 类定义完成');

// 插件生命周期
eagle.onPluginCreate((plugin) => {
    console.log('插件创建事件触发');
    try {
        window.imageViewer = new ImageViewer();
        console.log('ImageViewer 实例创建成功');
        
        setTimeout(() => {
            console.log('准备调用 init');
            if (window.imageViewer && typeof window.imageViewer.init === 'function') {
                window.imageViewer.init();
            } else {
                console.error('imageViewer.init 不是函数:', typeof window.imageViewer.init);
            }
        }, 1000);
    } catch (error) {
        console.error('创建 ImageViewer 实例失败:', error);
    }
});

eagle.onPluginShow(() => {
    console.log('插件显示事件触发');
    if (window.imageViewer && typeof window.imageViewer.loadImages === 'function') {
        window.imageViewer.loadImages();
    }
});

eagle.onPluginHide(() => {
    console.log('插件隐藏事件触发');
    if (window.imageViewer && typeof window.imageViewer.pausePlayback === 'function') {
        window.imageViewer.pausePlayback();
    }
});

eagle.onPluginBeforeExit(() => {
    console.log('插件退出事件触发');
    if (window.imageViewer && typeof window.imageViewer.stopPlayback === 'function') {
        window.imageViewer.stopPlayback();
    }
});

console.log('脚本加载完成');