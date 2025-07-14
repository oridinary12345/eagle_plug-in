class ImageViewer {
    constructor() {
        // 基本状态
        this.currentImages = [];
        this.currentIndex = 0;
        this.scale = 1;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.translateX = 0;
        this.translateY = 0;
        this.isFullscreen = false;
        
        // 播放控制
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeed = 1.0;
        this.fps = 12;
        this.isLooping = false;
        
        // 精灵图模式
        this.isSpriteMode = false;
        this.spriteFrames = [];
        this.originalImage = null;
        this.isOnionskinMode = false;
        
        // 进度条拖拽
        this.isProgressDragging = false;
        
        console.log('ImageViewer 构造函数执行完成');
    }

    // 初始化方法
    init() {
        console.log('开始初始化...');
        this.bindEvents();
        this.loadImages();
    }

    // 绑定事件
    bindEvents() {
        console.log('开始绑定事件...');
        
        // 基本导航按钮
        this.bindButton('prev-btn', () => this.previousImage());
        this.bindButton('next-btn', () => this.nextImage());
        this.bindButton('first-btn', () => this.goToFirst());
        this.bindButton('last-btn', () => this.goToLast());
        
        // 缩放按钮
        this.bindButton('zoom-in-btn', () => this.zoomIn());
        this.bindButton('zoom-out-btn', () => this.zoomOut());
        this.bindButton('reset-zoom-btn', () => this.resetZoom());
        this.bindButton('fullscreen-btn', () => this.toggleFullscreen());
        
        // 播放控制
        this.bindButton('play-pause-btn', () => this.togglePlayPause());
        this.bindButton('stop-btn', () => this.stopPlayback());
        this.bindButton('loop-btn', () => this.toggleLoop());
        this.bindButton('onionskin-btn', () => this.toggleOnionskinMode());
        
        // 刷新按钮
        this.bindButton('refresh-btn', () => this.loadImages());
        
        // 精灵图模式切换
        this.bindCheckbox('sprite-mode', (checked) => {
            this.isSpriteMode = checked;
            this.toggleSpriteMode();
        });
        
        // 精灵图配置
        this.bindButton('apply-sprite-config', () => this.applySpriteConfig());
        
        // 速度和帧率控制
        this.bindSlider('speed-slider', (value) => {
            this.playSpeed = parseFloat(value);
            this.setElementText('speed-value', this.playSpeed.toFixed(1) + 'x');
            if (this.isPlaying) {
                this.restartPlayback();
            }
        });
        
        this.bindSlider('fps-slider', (value) => {
            this.fps = parseInt(value);
            this.setElementText('fps-value', this.fps + ' FPS');
            if (this.isPlaying) {
                this.restartPlayback();
            }
        });
        
        // 进度条事件
        this.bindProgressBar();
        
        // 图片拖拽事件
        this.bindImageDrag();
        
        // 鼠标滚轮缩放
        this.bindWheelZoom();
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        console.log('事件绑定完成');
    }

    // 辅助方法：绑定按钮
    bindButton(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', callback);
        }
    }

    // 辅助方法：绑定复选框
    bindCheckbox(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (e) => callback(e.target.checked));
        }
    }

    // 辅助方法：绑定滑块
    bindSlider(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => callback(e.target.value));
        }
    }

    // 绑定进度条
    bindProgressBar() {
        const progressBar = document.querySelector('.progress-bar');
        const progressHandle = document.getElementById('progress-handle');
        
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                if (this.isProgressDragging) return;
                this.handleProgressClick(e);
            });
        }
        
        if (progressHandle) {
            progressHandle.addEventListener('mousedown', (e) => {
                this.isProgressDragging = true;
                e.preventDefault();
            });
        }
        
        // 全局鼠标事件
        document.addEventListener('mousemove', (e) => {
            if (this.isProgressDragging) {
                this.handleProgressDrag(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.isProgressDragging = false;
        });
    }

    // 绑定图片拖拽
    bindImageDrag() {
        const canvas = document.getElementById('main-canvas');
        const image = document.getElementById('main-image');
        
        [canvas, image].forEach(element => {
            if (element) {
                element.addEventListener('mousedown', (e) => this.startImageDrag(e));
                element.addEventListener('mousemove', (e) => this.handleImageDrag(e));
                element.addEventListener('mouseup', () => this.endImageDrag());
                element.addEventListener('mouseleave', () => this.endImageDrag());
            }
        });
    }

    // 绑定滚轮缩放
    bindWheelZoom() {
        const imageContainer = document.getElementById('image-container');
        if (imageContainer) {
            imageContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY > 0) {
                    this.zoomOut();
                } else {
                    this.zoomIn();
                }
            });
        }
    }

    // 键盘事件处理
    handleKeyDown(e) {
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
            case 'o':
            case 'O':
                this.toggleOnionskinMode();
                break;
            case 'Escape':
                if (this.isFullscreen) {
                    this.toggleFullscreen();
                } else if (this.isPlaying) {
                    this.stopPlayback();
                }
                break;
            case 'F11':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    // 进度条交互
    handleProgressClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const progress = (e.clientX - rect.left) / rect.width;
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        const newIndex = Math.round(progress * (totalFrames - 1));
        
        this.currentIndex = Math.max(0, Math.min(newIndex, totalFrames - 1));
        this.displayCurrentContent();
        this.updateProgress();
    }

    handleProgressDrag(e) {
        const progressBar = document.querySelector('.progress-bar');
        if (!progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        const newIndex = Math.round(progress * (totalFrames - 1));
        
        this.currentIndex = Math.max(0, Math.min(newIndex, totalFrames - 1));
        this.displayCurrentContent();
        this.updateProgress();
    }

    // 图片拖拽
    startImageDrag(e) {
        if (this.scale <= 1) return;
        
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        e.preventDefault();
    }

    handleImageDrag(e) {
        if (!this.isDragging) return;

        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;

        this.translateX += deltaX / this.scale;
        this.translateY += deltaY / this.scale;

        this.updateImageTransform();

        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    endImageDrag() {
        this.isDragging = false;
    }

    // 加载图片
    async loadImages() {
        try {
            console.log('开始加载图片...');
            this.showLoading();
            this.stopPlayback();
            
            // 检查 eagle API
            if (typeof eagle === 'undefined') {
                console.error('Eagle API 不可用');
                this.showError('Eagle API 不可用');
                return;
            }

            const selectedItems = await eagle.item.getSelected();
            console.log('获取到的项目:', selectedItems);
            
            // 过滤图片
            this.currentImages = selectedItems.filter(item => {
                const ext = item.ext.toLowerCase();
                return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
            });

            console.log('过滤后的图片:', this.currentImages);

            if (this.currentImages.length === 0) {
                this.showNoSelection();
                return;
            }

            this.currentImages.sort((a, b) => a.name.localeCompare(b.name));
            this.currentIndex = 0;
            this.showViewer();
            
            if (this.isSpriteMode) {
                await this.loadSpriteFrames();
            } else {
                this.renderThumbnails();
                this.displayCurrentImage();
            }
            
            this.renderTimelineMarkers();
            this.updateProgress();
            
        } catch (error) {
            console.error('加载图片失败:', error);
            this.showError('加载图片失败: ' + error.message);
        }
    }

    // 精灵图模式切换
    toggleSpriteMode() {
        console.log('切换精灵图模式:', this.isSpriteMode);
        const spriteConfig = document.getElementById('sprite-config');
        const thumbnailPanel = document.querySelector('.thumbnail-panel');
        
        if (this.isSpriteMode) {
            if (spriteConfig) spriteConfig.style.display = 'block';
            if (thumbnailPanel) thumbnailPanel.classList.add('sprite-mode');
            this.applySpriteConfig();
        } else {
            if (spriteConfig) spriteConfig.style.display = 'none';
            if (thumbnailPanel) thumbnailPanel.classList.remove('sprite-mode');
            this.renderThumbnails();
            this.displayCurrentImage();
        }
        
        this.renderTimelineMarkers();
        this.updateProgress();
    }

    // 应用精灵图配置
    applySpriteConfig() {
        const cols = parseInt(this.getElementValue('sprite-cols', '4'));
        const rows = parseInt(this.getElementValue('sprite-rows', '4'));
        const startFrame = parseInt(this.getElementValue('start-frame', '0'));
        const endFrame = parseInt(this.getElementValue('end-frame', '15'));
        const direction = this.getElementValue('read-direction', 'horizontal');

        this.spriteConfig = { cols, rows, startFrame, endFrame, direction };
        console.log('精灵图配置:', this.spriteConfig);

        // 更新结束帧的最大值
        const maxFrames = cols * rows - 1;
        const endFrameEl = document.getElementById('end-frame');
        if (endFrameEl) {
            endFrameEl.max = maxFrames;
            if (endFrame > maxFrames) {
                endFrameEl.value = maxFrames;
                this.spriteConfig.endFrame = maxFrames;
            }
        }

        if (this.isSpriteMode && this.currentImages.length > 0) {
            this.loadSpriteFrames();
        }
    }

    // 获取元素值的辅助方法
    getElementValue(id, defaultValue) {
        const element = document.getElementById(id);
        return element ? element.value : defaultValue;
    }

    // 加载精灵图帧
    async loadSpriteFrames() {
        if (this.currentImages.length === 0) return;

        const currentImage = this.currentImages[this.currentIndex];
        console.log('加载精灵图:', currentImage.filePath);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                console.log('精灵图加载成功');
                this.originalImage = img;
                this.extractSpriteFrames(img);
                this.renderSpriteFrameThumbnails();
                this.displayCurrentFrame();
                this.renderTimelineMarkers();
                this.updateProgress();
                resolve();
            };
            img.onerror = () => {
                console.error('精灵图加载失败');
                this.showError('精灵图加载失败');
                resolve();
            };
            img.src = `file://${currentImage.filePath}`;
        });
    }

    // 提取精灵图帧
    extractSpriteFrames(img) {
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
    }

    // 洋葱皮模式
    toggleOnionskinMode() {
        this.isOnionskinMode = !this.isOnionskinMode;
        const btn = document.getElementById('onionskin-btn');
        const container = document.getElementById('image-container');
        
        if (this.isOnionskinMode) {
            if (btn) btn.classList.add('active');
            if (container) container.classList.add('onionskin-active');
        } else {
            if (btn) btn.classList.remove('active');
            if (container) container.classList.remove('onionskin-active');
        }
        
        if (this.isSpriteMode) {
            this.displayCurrentFrame();
        }
    }

    // 绘制洋葱皮
    drawOnionskin(ctx, currentFrame) {
        const onionskinFrames = 3;
        const baseOpacity = 0.3;
        
        for (let i = 1; i <= onionskinFrames; i++) {
            // 绘制前面的帧
            if (this.currentIndex - i >= 0) {
                const prevFrame = this.spriteFrames[this.currentIndex - i];
                ctx.globalAlpha = baseOpacity / i;
                ctx.drawImage(
                    this.originalImage,
                    prevFrame.x, prevFrame.y, prevFrame.width, prevFrame.height,
                    0, 0, currentFrame.width, currentFrame.height
                );
            }
            
            // 绘制后面的帧
            if (this.currentIndex + i < this.spriteFrames.length) {
                const nextFrame = this.spriteFrames[this.currentIndex + i];
                ctx.globalAlpha = baseOpacity / i;
                ctx.drawImage(
                    this.originalImage,
                    nextFrame.x, nextFrame.y, nextFrame.width, nextFrame.height,
                    0, 0, currentFrame.width, currentFrame.height
                );
            }
        }
        
        ctx.globalAlpha = 1;
    }

    // 渲染时间轴标记
    renderTimelineMarkers() {
        const timelineMarkers = document.getElementById('timeline-markers');
        if (!timelineMarkers) return;
        
        timelineMarkers.innerHTML = '';

        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        
        if (totalFrames <= 50) {
            for (let i = 0; i < totalFrames; i++) {
                const marker = document.createElement('div');
                marker.className = 'timeline-marker';
                marker.setAttribute('data-index', i);
                timelineMarkers.appendChild(marker);
            }
        }
    }

    // 更新进度条
    updateProgress() {
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        const progress = (this.currentIndex / Math.max(totalFrames - 1, 1)) * 100;
        
        const progressFill = document.getElementById('progress-fill');
        const progressHandle = document.getElementById('progress-handle');
        
        if (progressFill) {
            progressFill.style.width = progress + '%';
        }
        if (progressHandle) {
            progressHandle.style.left = progress + '%';
        }

        // 更新时间轴标记
        const markers = document.querySelectorAll('.timeline-marker');
        markers.forEach((marker, index) => {
            if (index === this.currentIndex) {
                marker.classList.add('active');
            } else {
                marker.classList.remove('active');
            }
        });
    }

    // 显示当前内容（统一方法）
    displayCurrentContent() {
        if (this.isSpriteMode) {
            this.displayCurrentFrame();
        } else {
            this.displayCurrentImage();
        }
        this.updateThumbnailSelection();
    }

    // 渲染精灵图缩略图
    renderSpriteFrameThumbnails() {
        const thumbnailList = document.getElementById('thumbnail-list');
        const totalCount = document.getElementById('total-count');
        
        if (!thumbnailList || !totalCount) return;
        
        thumbnailList.innerHTML = '';
        totalCount.textContent = `${this.spriteFrames.length} 帧`;

        this.spriteFrames.forEach((frame, index) => {
            const thumbnailItem = document.createElement('div');
            thumbnailItem.className = 'thumbnail-item sprite-frame';
            
            const canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            canvas.className = 'thumbnail-image';
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(
                this.originalImage,
                frame.x, frame.y, frame.width, frame.height,
                0, 0, 40, 40
            );
            
            const thumbnailInfo = document.createElement('div');
            thumbnailInfo.className = 'thumbnail-info';
            thumbnailInfo.innerHTML = `
                <div class="thumbnail-name">帧 ${frame.index}</div>
                <div class="thumbnail-size">${Math.round(frame.width)}×${Math.round(frame.height)}</div>
            `;
            
            thumbnailItem.appendChild(canvas);
            thumbnailItem.appendChild(thumbnailInfo);

            thumbnailItem.addEventListener('click', () => {
                this.currentIndex = index;
                this.displayCurrentFrame();
                this.updateThumbnailSelection();
                this.updateProgress();
            });

            thumbnailList.appendChild(thumbnailItem);
        });

        this.updateThumbnailSelection();
    }

    // 渲染普通缩略图
    renderThumbnails() {
        const thumbnailList = document.getElementById('thumbnail-list');
        const totalCount = document.getElementById('total-count');
        
        if (!thumbnailList || !totalCount) return;
        
        thumbnailList.innerHTML = '';
        totalCount.textContent = `${this.currentImages.length} 张图片`;

        this.currentImages.forEach((image, index) => {
            const thumbnailItem = document.createElement('div');
            thumbnailItem.className = 'thumbnail-item';
            
            thumbnailItem.innerHTML = `
                <img class="thumbnail-image" src="file://${image.filePath}" alt="${image.name}">
                <div class="thumbnail-info">
                    <div class="thumbnail-name">${image.name}</div>
                    <div class="thumbnail-size">${image.width} × ${image.height}</div>
                </div>
            `;

            thumbnailItem.addEventListener('click', () => {
                this.currentIndex = index;
                if (this.isSpriteMode) {
                    this.loadSpriteFrames();
                } else {
                    this.displayCurrentImage();
                }
                this.updateThumbnailSelection();
                this.updateProgress();
            });

            thumbnailList.appendChild(thumbnailItem);
        });

        this.updateThumbnailSelection();
    }

    // 更新缩略图选择状态
    updateThumbnailSelection() {
        const thumbnailItems = document.querySelectorAll('.thumbnail-item');
        thumbnailItems.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const activeItem = document.querySelector('.thumbnail-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // 显示当前帧（精灵图模式）
    displayCurrentFrame() {
        if (this.spriteFrames.length === 0) return;

        const frame = this.spriteFrames[this.currentIndex];
        const canvas = document.getElementById('main-canvas');
        const mainImage = document.getElementById('main-image');
        
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // 设置画布尺寸
        canvas.width = frame.width;
        canvas.height = frame.height;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制洋葱皮（在当前帧之前）
        if (this.isOnionskinMode) {
            this.drawOnionskin(ctx, frame);
        }
        
        // 绘制当前帧
        ctx.globalAlpha = 1;
        ctx.drawImage(
            this.originalImage,
            frame.x, frame.y, frame.width, frame.height,
            0, 0, frame.width, frame.height
        );
        
        // 显示画布，隐藏图片
        canvas.style.display = 'block';
        if (mainImage) mainImage.style.display = 'none';

        this.updateUI();
    }

    // 显示当前图片（普通模式）
    displayCurrentImage() {
        if (this.currentImages.length === 0) return;

        const currentImage = this.currentImages[this.currentIndex];
        const imageElement = document.getElementById('main-image');
        const canvas = document.getElementById('main-canvas');
        const imageLoading = document.getElementById('image-loading');

        if (!imageElement) return;

        // 显示图片，隐藏画布
        imageElement.style.display = 'block';
        if (canvas) canvas.style.display = 'none';

        if (imageLoading) imageLoading.style.display = 'flex';
        imageElement.style.opacity = '0.3';

        this.resetTransform();

        imageElement.src = `file://${currentImage.filePath}`;
        
        imageElement.onload = () => {
            if (imageLoading) imageLoading.style.display = 'none';
            imageElement.style.opacity = '1';
        };

        imageElement.onerror = () => {
            if (imageLoading) imageLoading.style.display = 'none';
            imageElement.style.opacity = '1';
            this.showError('图片加载失败');
        };

        this.updateUI();
    }

    // 更新UI
    updateUI() {
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        const currentImage = this.currentImages[this.currentIndex];
        
        // 更新帧计数
        this.setElementText('current-frame', this.currentIndex + 1);
        this.setElementText('total-frames', totalFrames);

        // 更新按钮状态
        this.setElementDisabled('prev-btn', this.currentIndex === 0);
        this.setElementDisabled('next-btn', this.currentIndex === totalFrames - 1);
        this.setElementDisabled('first-btn', this.currentIndex === 0);
        this.setElementDisabled('last-btn', this.currentIndex === totalFrames - 1);

        // 更新图片信息
        this.setElementText('image-name', currentImage.name);
        
        if (this.isSpriteMode && this.spriteFrames.length > 0) {
            const frame = this.spriteFrames[this.currentIndex];
            this.setElementText('image-size', `${Math.round(frame.width)} × ${Math.round(frame.height)}`);
            this.setElementText('mode-info', `精灵图模式 (${this.spriteConfig.cols}×${this.spriteConfig.rows})`);
        } else {
            this.setElementText('image-size', `${currentImage.width} × ${currentImage.height}`);
            this.setElementText('mode-info', '普通模式');
        }
    }

    // 设置元素文本的辅助方法
    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    // 设置元素禁用状态的辅助方法
    setElementDisabled(id, disabled) {
        const element = document.getElementById(id);
        if (element) element.disabled = disabled;
    }

    // 播放控制
    togglePlayPause() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        if (totalFrames <= 1) return;

        this.isPlaying = true;
        this.updatePlayButton();
        this.showPlayIndicator();

        const interval = (1000 / this.fps) / this.playSpeed;
        this.playInterval = setInterval(() => {
            this.nextFrame();
        }, interval);
    }

    pausePlayback() {
        this.isPlaying = false;
        this.updatePlayButton();
        this.hidePlayIndicator();
        
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    stopPlayback() {
        this.pausePlayback();
        this.currentIndex = 0;
        this.displayCurrentContent();
        this.updateProgress();
    }

    restartPlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
            this.startPlayback();
        }
    }

    nextFrame() {
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        
        if (this.currentIndex < totalFrames - 1) {
            this.currentIndex++;
        } else if (this.isLooping) {
            this.currentIndex = 0;
        } else {
            this.pausePlayback();
            return;
        }

        this.displayCurrentContent();
        this.updateProgress();
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
        const indicator = document.getElementById('play-indicator');
        if (indicator) indicator.style.display = 'flex';
    }

    hidePlayIndicator() {
        const indicator = document.getElementById('play-indicator');
        if (indicator) indicator.style.display = 'none';
    }

    // 导航方法
    goToFirst() {
        this.currentIndex = 0;
        this.displayCurrentContent();
        this.updateProgress();
    }

    goToLast() {
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        this.currentIndex = totalFrames - 1;
        this.displayCurrentContent();
        this.updateProgress();
    }

    previousImage() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCurrentContent();
            this.updateProgress();
        }
    }

    nextImage() {
        const totalFrames = this.isSpriteMode ? this.spriteFrames.length : this.currentImages.length;
        if (this.currentIndex < totalFrames - 1) {
            this.currentIndex++;
            this.displayCurrentContent();
            this.updateProgress();
        }
    }

    // 缩放方法
    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 5);
        this.updateImageTransform();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.1);
        this.updateImageTransform();
    }

    resetZoom() {
        this.resetTransform();
    }

    resetTransform() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateImageTransform();
    }

    updateImageTransform() {
        const image = document.getElementById('main-image');
        const canvas = document.getElementById('main-canvas');
        
        const transform = `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`;
        if (image) image.style.transform = transform;
        if (canvas) canvas.style.transform = transform;
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        
        if (this.isFullscreen) {
            document.body.classList.add('fullscreen');
        } else {
            document.body.classList.remove('fullscreen');
        }
    }

    // 显示状态方法
    showLoading() {
        this.setElementDisplay('loading', 'flex');
        this.setElementDisplay('no-selection', 'none');
        this.setElementDisplay('viewer', 'none');
    }

    showNoSelection() {
        this.setElementDisplay('loading', 'none');
        this.setElementDisplay('no-selection', 'flex');
        this.setElementDisplay('viewer', 'none');
    }

    showViewer() {
        this.setElementDisplay('loading', 'none');
        this.setElementDisplay('no-selection', 'none');
        this.setElementDisplay('viewer', 'flex');
    }

    setElementDisplay(id, display) {
        const element = document.getElementById(id);
        if (element) element.style.display = display;
    }

    showError(message) {
        console.error(message);
        alert(message);
    }
}

// 插件生命周期
eagle.onPluginCreate((plugin) => {
    console.log('插件创建');
    window.imageViewer = new ImageViewer();
    // 延迟初始化，确保DOM完全加载
    setTimeout(() => {
        window.imageViewer.init();
    }, 500);
});

eagle.onPluginShow(() => {
    console.log('插件显示');
    if (window.imageViewer) {
        window.imageViewer.loadImages();
    }
});

eagle.onPluginHide(() => {
    console.log('插件隐藏');
    if (window.imageViewer) {
        window.imageViewer.pausePlayback();
    }
});

eagle.onPluginBeforeExit(() => {
    console.log('插件退出');
    if (window.imageViewer) {
        window.imageViewer.stopPlayback();
    }
});