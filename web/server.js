#!/usr/bin/env node
/**
 * QQL CalliGAN Web Server
 * 一个简单的Node.js Express服务器，用于提供Web界面和API接口
 */

const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 项目路径配置
const PROJECT_ROOT = path.join(__dirname, '..');
const QQL_CLI_PATH = path.join(PROJECT_ROOT, 'target', 'release', 'qql-cli.exe');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');

// 确保输出目录存在
async function ensureOutputDir() {
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
        console.error('创建输出目录失败:', error);
    }
}

// 运行命令的辅助函数
function runCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const child = spawn(command, args, {
            cwd: options.cwd || PROJECT_ROOT,
            ...options
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            resolve({
                success: code === 0,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                code,
                duration
            });
        });

        child.on('error', (error) => {
            resolve({
                success: false,
                stdout: '',
                stderr: error.message,
                code: -1,
                duration: Date.now() - startTime
            });
        });

        // 设置超时
        if (options.timeout) {
            setTimeout(() => {
                child.kill();
                resolve({
                    success: false,
                    stdout,
                    stderr: stderr + '\\n命令执行超时',
                    code: -1,
                    duration: Date.now() - startTime
                });
            }, options.timeout);
        }
    });
}

// 路由定义

// 主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 检查系统状态
app.get('/api/status', async (req, res) => {
    try {
        // 检查qql-cli是否存在
        try {
            await fs.access(QQL_CLI_PATH);
        } catch {
            return res.json({
                success: false,
                error: `qql-cli.exe 未找到: ${QQL_CLI_PATH}`
            });
        }

        // 尝试运行qql-cli --version
        const result = await runCommand(QQL_CLI_PATH, ['--version'], { timeout: 10000 });

        if (result.success) {
            res.json({
                success: true,
                version: result.stdout,
                cli_path: QQL_CLI_PATH,
                output_dir: OUTPUT_DIR
            });
        } else {
            res.json({
                success: false,
                error: `qql-cli 执行失败: ${result.stderr}`
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: `状态检查失败: ${error.message}`
        });
    }
});

// 测试后端CLI
app.get('/api/test', async (req, res) => {
    try {
        const result = await runCommand(QQL_CLI_PATH, ['--help'], { timeout: 10000 });

        if (result.success) {
            res.json({
                success: true,
                output: result.stdout
            });
        } else {
            res.json({
                success: false,
                error: result.stderr,
                output: result.stdout
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 获取帮助信息
app.get('/api/help', async (req, res) => {
    try {
        const result = await runCommand(QQL_CLI_PATH, ['--help'], { timeout: 10000 });

        if (result.success) {
            res.json({
                success: true,
                help: result.stdout
            });
        } else {
            res.json({
                success: false,
                error: result.stderr
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 生成艺术作品
app.post('/api/generate', async (req, res) => {
    try {
        const { seed, width = 800, traits = {} } = req.body;

        // 验证种子格式
        if (!seed || !seed.startsWith('0x') || seed.length !== 66) {
            return res.json({
                success: false,
                error: 'Invalid seed format. Seed must be a 64-character hexadecimal string starting with 0x.'
            });
        }

        // 生成输出文件名
        const timestamp = Date.now();
        const seedShort = seed.substring(2, 10); // 去掉0x前缀，取前8位
        const filename = `qql_${seedShort}_${timestamp}.png`;

        // 确保输出目录存在
        await ensureOutputDir();
        const outputFile = path.join(OUTPUT_DIR, filename);

        // 构建命令参数 - 种子作为位置参数，去掉0x前缀
        const seedHex = seed.startsWith('0x') ? seed.substring(2) : seed;
        const args = [seedHex, '--width', width.toString(), '-o', outputFile];

        console.log(`生成艺术作品: ${seed}, 宽度: ${width}, 输出: ${filename}`);
        console.log(`特征参数:`, traits);

        // 运行命令
        const result = await runCommand(QQL_CLI_PATH, args, { timeout: 300000 }); // 5分钟超时

        if (result.success) {
            res.json({
                success: true,
                filename,
                seed,
                width,
                traits,
                duration: `${(result.duration / 1000).toFixed(2)}秒`,
                logs: result.stdout
            });
        } else {
            console.error('生成失败:', result.stderr);
            res.json({
                success: false,
                error: result.stderr || 'Generation failed',
                logs: result.stdout
            });
        }
    } catch (error) {
        console.error('API错误:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 保存艺术作品API
app.post('/api/save', async (req, res) => {
    try {
        const { seed } = req.body;

        if (!seed) {
            return res.json({
                success: false,
                error: 'No seed provided'
            });
        }

        // 查找最新生成的文件
        const files = await fs.readdir(OUTPUT_DIR);
        const seedShort = seed.substring(2, 10);
        const matchingFiles = files.filter(file => 
            file.includes(seedShort) && file.endsWith('.png')
        );

        if (matchingFiles.length === 0) {
            return res.json({
                success: false,
                error: 'No generated artwork found for this seed'
            });
        }

        // 获取最新的文件
        const latestFile = matchingFiles.sort().pop();
        const timestamp = Date.now();
        const savedFilename = `saved_${seedShort}_${timestamp}.png`;
        
        const sourcePath = path.join(OUTPUT_DIR, latestFile);
        const savedPath = path.join(OUTPUT_DIR, savedFilename);

        // 复制文件
        await fs.copyFile(sourcePath, savedPath);

        res.json({
            success: true,
            filename: savedFilename,
            originalFile: latestFile,
            seed
        });

    } catch (error) {
        console.error('保存错误:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 提供图片文件访问
app.get('/api/image/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const imagePath = path.join(OUTPUT_DIR, filename);
        
        // 检查文件是否存在
        try {
            await fs.access(imagePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        // 设置正确的Content-Type
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年
        
        // 发送文件
        res.sendFile(imagePath);
    } catch (error) {
        console.error('图片访问错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 列出生成的文件
app.get('/api/list-outputs', async (req, res) => {
    try {
        const files = [];
        
        try {
            const dirEntries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
            
            for (const entry of dirEntries) {
                if (entry.isFile() && entry.name.endsWith('.png')) {
                    const filePath = path.join(OUTPUT_DIR, entry.name);
                    const stats = await fs.stat(filePath);
                    
                    files.push({
                        name: entry.name,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime.getTime()
                    });
                }
            }
        } catch (error) {
            // 目录不存在或其他错误
        }

        // 按创建时间排序
        files.sort((a, b) => b.created - a.created);

        res.json({
            success: true,
            files
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 错误处理
app.use((req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
async function startServer() {
    await ensureOutputDir();
    
    console.log('🎨 QQL CalliGAN Web Server');
    console.log(`📁 项目根目录: ${PROJECT_ROOT}`);
    console.log(`🔧 CLI路径: ${QQL_CLI_PATH}`);
    console.log(`📂 输出目录: ${OUTPUT_DIR}`);
    console.log('🌐 启动Web服务器...');

    // 检查CLI是否存在
    try {
        await fs.access(QQL_CLI_PATH);
        console.log('✅ qql-cli.exe 已找到');
    } catch {
        console.log(`⚠️  警告: qql-cli.exe 未找到于 ${QQL_CLI_PATH}`);
        console.log('请先编译Rust项目: cargo build --release');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 服务器启动于 http://localhost:${PORT}`);
        console.log('按 Ctrl+C 停止服务器');
    });
}

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\\n🛑 正在关闭服务器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\\n🛑 正在关闭服务器...');
    process.exit(0);
});

// 启动
startServer().catch(console.error);