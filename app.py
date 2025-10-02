from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import threading
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Configuration
DOWNLOAD_FOLDER = "downloads"
Path(DOWNLOAD_FOLDER).mkdir(exist_ok=True)

# Store download progress
download_progress = {}

class DownloadProgressHook:
    def __init__(self, video_id):
        self.video_id = video_id
        
    def hook(self, d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            if total > 0:
                percent = (downloaded / total) * 100
                download_progress[self.video_id] = {
                    'percent': round(percent, 1),
                    'speed': d.get('speed', 0),
                    'eta': d.get('eta', 0)
                }
        elif d['status'] == 'finished':
            download_progress[self.video_id] = {
                'percent': 100,
                'speed': 0,
                'eta': 0
            }

def get_video_info(url):
    """Extract video information without downloading"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Get available formats
            formats = []
            for f in info['formats']:
                if f.get('filesize') or f.get('filesize_approx'):
                    format_note = f.get('format_note', 'unknown')
                    ext = f.get('ext', 'unknown')
                    filesize = f.get('filesize') or f.get('filesize_approx', 0)
                    
                    # Categorize formats
                    if f.get('vcodec') != 'none' and f.get('acodec') != 'none':
                        # Video with audio
                        quality = f"{format_note} ({ext})"
                        format_type = 'video'
                    elif f.get('vcodec') != 'none':
                        # Video only
                        quality = f"{format_note} video ({ext})"
                        format_type = 'video'
                    else:
                        # Audio only
                        quality = f"{format_note} audio ({ext})"
                        format_type = 'audio'
                    
                    formats.append({
                        'format_id': f['format_id'],
                        'quality': quality,
                        'type': format_type,
                        'filesize': filesize,
                        'ext': ext
                    })
            
            return {
                'success': True,
                'title': info.get('title', 'Unknown Title'),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration_string', 'Unknown'),
                'channel': info.get('uploader', 'Unknown Channel'),
                'view_count': info.get('view_count', 0),
                'upload_date': info.get('upload_date', ''),
                'formats': formats
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def download_video(url, format_id, video_id):
    """Download video in background thread"""
    def download():
        ydl_opts = {
            'format': format_id,
            'outtmpl': f'{DOWNLOAD_FOLDER}/%(title)s.%(ext)s',
            'progress_hooks': [DownloadProgressHook(video_id).hook],
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as e:
            download_progress[video_id] = {'error': str(e)}
    
    thread = threading.Thread(target=download)
    thread.start()

# API Routes
@app.route('/api/video-info', methods=['POST'])
def video_info():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'success': False, 'error': 'No URL provided'})
    
    result = get_video_info(url)
    return jsonify(result)

@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id')
    video_id = data.get('video_id')
    
    if not all([url, format_id, video_id]):
        return jsonify({'success': False, 'error': 'Missing parameters'})
    
    download_video(url, format_id, video_id)
    return jsonify({'success': True, 'message': 'Download started'})

@app.route('/api/progress/<video_id>')
def progress(video_id):
    progress_data = download_progress.get(video_id, {})
    return jsonify(progress_data)

@app.route('/api/downloads/<filename>')
def download_file(filename):
    file_path = os.path.join(DOWNLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
