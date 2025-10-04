#!/usr/bin/env python3
"""
QQL CalliGAN Web Server
一个简单的Python Flask服务器，用于提供Web界面和API接口
"""

import os
import sys
import json
import subprocess
import time
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
QQL_CLI_PATH = PROJECT_ROOT / "target" / "release" / "qql-cli.exe"
OUTPUT_DIR = PROJECT_ROOT / "output"

# 确保输出目录存在
OUTPUT_DIR.mkdir(exist_ok=True)

def run_command(cmd, cwd=None, timeout=300):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd or PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding='utf-8',
            errors='replace'
        )
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': f'命令执行超时 ({timeout}秒)',
            'returncode': -1
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'returncode': -1
        }

@app.route('/')
def index():
    """提供主页"""
    return send_from_directory(Path(__file__).parent, 'index.html')

@app.route('/api/status')
def get_status():
    """检查系统状态"""
    try:
        # 检查qql-cli是否存在
        if not QQL_CLI_PATH.exists():
            return jsonify({
                'success': False,
                'error': f'qql-cli.exe 未找到: {QQL_CLI_PATH}'
            })
        
        # 尝试运行qql-cli --version
        result = run_command([str(QQL_CLI_PATH), '--version'], timeout=10)
        
        if result['success']:
            version_info = result['stdout'].strip()
            return jsonify({
                'success': True,
                'version': version_info,
                'cli_path': str(QQL_CLI_PATH),
                'output_dir': str(OUTPUT_DIR)
            })
        else:
            return jsonify({
                'success': False,
                'error': f'qql-cli 执行失败: {result["stderr"]}'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'状态检查失败: {str(e)}'
        })

@app.route('/api/test')
def test_backend():
    """测试后端CLI"""
    try:
        # 运行qql-cli --help
        result = run_command([str(QQL_CLI_PATH), '--help'], timeout=10)
        
        if result['success']:
            return jsonify({
                'success': True,
                'output': result['stdout']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['stderr'],
                'output': result['stdout']
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/help')
def get_help():
    """获取帮助信息"""
    try:
        result = run_command([str(QQL_CLI_PATH), '--help'], timeout=10)
        
        if result['success']:
            return jsonify({
                'success': True,
                'help': result['stdout']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['stderr']
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/generate', methods=['POST'])
def generate_art():
    """生成艺术作品"""
    try:
        data = request.get_json()
        seed = data.get('seed')
        width = data.get('width', 2400)
        output_path = data.get('outputPath', './output')
        
        # 生成输出文件名
        timestamp = int(time.time())
        if seed:
            filename = f"qql_{seed[:8]}_{timestamp}.png"
        else:
            filename = f"qql_random_{timestamp}.png"
        
        # 确保输出目录存在
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / filename
        
        # 构建命令
        cmd = [str(QQL_CLI_PATH)]
        
        if seed:
            cmd.extend(['--seed', seed])
        
        cmd.extend([
            '--width', str(width),
            '--output', str(output_file)
        ])
        
        # 记录开始时间
        start_time = time.time()
        
        # 运行命令
        result = run_command(cmd, timeout=600)  # 10分钟超时
        
        # 计算耗时
        duration = time.time() - start_time
        
        if result['success']:
            return jsonify({
                'success': True,
                'outputFile': str(output_file),
                'seed': seed or 'random',
                'duration': f'{duration:.2f}秒',
                'logs': result['stdout']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['stderr'],
                'logs': result['stdout']
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/list-outputs')
def list_outputs():
    """列出生成的文件"""
    try:
        files = []
        if OUTPUT_DIR.exists():
            for file_path in OUTPUT_DIR.glob('*.png'):
                stat = file_path.stat()
                files.append({
                    'name': file_path.name,
                    'path': str(file_path),
                    'size': stat.st_size,
                    'created': stat.st_ctime
                })
        
        # 按创建时间排序
        files.sort(key=lambda x: x['created'], reverse=True)
        
        return jsonify({
            'success': True,
            'files': files
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'API endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("🎨 QQL CalliGAN Web Server")
    print(f"📁 项目根目录: {PROJECT_ROOT}")
    print(f"🔧 CLI路径: {QQL_CLI_PATH}")
    print(f"📂 输出目录: {OUTPUT_DIR}")
    print("🌐 启动Web服务器...")
    
    # 检查CLI是否存在
    if not QQL_CLI_PATH.exists():
        print(f"⚠️  警告: qql-cli.exe 未找到于 {QQL_CLI_PATH}")
        print("请先编译Rust项目: cargo build --release")
    else:
        print("✅ qql-cli.exe 已找到")
    
    print("🚀 服务器启动于 http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)