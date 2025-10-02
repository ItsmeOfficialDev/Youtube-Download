class TubeFetch {
    constructor() {
        this.baseUrl = 'http://localhost:5000/api';
        this.currentVideoId = null;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const fetchBtn = document.getElementById('fetchBtn');
        const urlInput = document.getElementById('youtubeUrl');

        fetchBtn.addEventListener('click', () => this.fetchVideoInfo());
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchVideoInfo();
        });
    }

    async fetchVideoInfo() {
        const url = document.getElementById('youtubeUrl').value.trim();
        const fetchBtn = document.getElementById('fetchBtn');
        
        if (!url) {
            this.showError('Please enter a YouTube URL');
            return;
        }

        if (!this.isValidYouTubeUrl(url)) {
            this.showError('Please enter a valid YouTube URL');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch(`${this.baseUrl}/video-info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (data.success) {
                this.displayVideoInfo(data);
                this.currentVideoId = this.extractVideoId(url);
            } else {
                this.showError(data.error || 'Failed to fetch video information');
            }
        } catch (error) {
            this.showError('Network error. Please check if the backend server is running.');
            console.error('Error:', error);
        } finally {
            this.setLoading(false);
        }
    }

    isValidYouTubeUrl(url) {
        const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        return regex.test(url);
    }

    extractVideoId(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    displayVideoInfo(data) {
        // Show preview section
        const previewSection = document.getElementById('videoPreview');
        previewSection.classList.remove('hidden');

        // Update preview content
        document.getElementById('previewThumbnail').src = data.thumbnail;
        document.getElementById('previewTitle').textContent = data.title;
        document.getElementById('previewChannel').textContent = data.channel;
        document.getElementById('videoDuration').textContent = data.duration;
        document.getElementById('previewViews').textContent = this.formatViews(data.view_count) + ' views';
        document.getElementById('previewUploadDate').textContent = this.formatDate(data.upload_date);

        // Generate download options
        this.generateDownloadOptions(data.formats);
        
        // Show download section
        const downloadSection = document.getElementById('downloadSection');
        downloadSection.classList.remove('hidden');
    }

    generateDownloadOptions(formats) {
        const qualityGrid = document.getElementById('qualityGrid');
        qualityGrid.innerHTML = '';

        // Filter and categorize formats
        const videoFormats = formats.filter(f => f.type === 'video');
        const audioFormats = formats.filter(f => f.type === 'audio');

        // Add video quality buttons
        videoFormats.forEach(format => {
            const button = this.createQualityButton(format, 'video');
            qualityGrid.appendChild(button);
        });

        // Add audio quality buttons
        audioFormats.forEach(format => {
            const button = this.createQualityButton(format, 'audio');
            qualityGrid.appendChild(button);
        });
    }

    createQualityButton(format, type) {
        const button = document.createElement('button');
        button.className = `quality-btn ${type === 'audio' ? 'audio' : ''}`;
        button.innerHTML = `
            <div class="quality-label">${format.quality}</div>
            <div class="quality-size">${this.formatFileSize(format.filesize)}</div>
        `;

        button.addEventListener('click', () => {
            this.startDownload(format.format_id);
        });

        return button;
    }

    async startDownload(formatId) {
        if (!this.currentVideoId) return;

        const url = document.getElementById('youtubeUrl').value.trim();
        
        // Show progress section
        const progressSection = document.getElementById('progressSection');
        progressSection.classList.remove('hidden');

        try {
            // Start download
            await fetch(`${this.baseUrl}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    format_id: formatId,
                    video_id: this.currentVideoId
                })
            });

            // Start polling for progress
            this.pollProgress();
        } catch (error) {
            this.showError('Failed to start download');
            console.error('Error:', error);
        }
    }

    async pollProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressStatus = document.getElementById('progressStatus');
        const downloadSpeed = document.getElementById('downloadSpeed');
        const timeRemaining = document.getElementById('timeRemaining');

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${this.baseUrl}/progress/${this.currentVideoId}`);
                const progress = await response.json();

                if (progress.error) {
                    this.showError(progress.error);
                    clearInterval(interval);
                    return;
                }

                if (progress.percent !== undefined) {
                    const percent = progress.percent;
                    progressFill.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;
                    progressStatus.textContent = percent === 100 ? 'Download Complete!' : 'Downloading...';
                    
                    if (progress.speed) {
                        downloadSpeed.textContent = `Speed: ${this.formatSpeed(progress.speed)}`;
                    }
                    
                    if (progress.eta) {
                        timeRemaining.textContent = `ETA: ${this.formatTime(progress.eta)}`;
                    }

                    if (percent === 100) {
                        clearInterval(interval);
                        setTimeout(() => {
                            progressSection.classList.add('hidden');
                        }, 3000);
                    }
                }
            } catch (error) {
                console.error('Error polling progress:', error);
            }
        }, 1000);
    }

    setLoading(loading) {
        const fetchBtn = document.getElementById('fetchBtn');
        const btnText = fetchBtn.querySelector('.btn-text');
        const btnLoader = fetchBtn.querySelector('.btn-loader');

        if (loading) {
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
            fetchBtn.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            fetchBtn.disabled = false;
        }
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    formatViews(views) {
        if (views >= 1000000) {
            return (views / 1000000).toFixed(1) + 'M';
        } else if (views >= 1000) {
            return (views / 1000).toFixed(1) + 'K';
        }
        return views;
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown size';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatSpeed(bytesPerSecond) {
        return this.formatFileSize(bytesPerSecond) + '/s';
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown date';
        
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new TubeFetch();
});
