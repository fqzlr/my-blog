/**
 * 测试 Moments API 的脚本
 * 用于验证 GitHub App 认证和仓库文件操作是否正常
 */

const fs = require('fs');
const path = require('path');

console.log('=== Moments API 测试 ===\n');

// 检查环境变量
console.log('1. 检查环境变量配置:');
console.log(`   GH_APP_ID: ${process.env.GH_APP_ID ? '✓ 已配置' : '✗ 未配置'}`);
console.log(`   GH_PRIVATE_KEY: ${process.env.GH_PRIVATE_KEY ? '✓ 已配置' : '✗ 未配置'}`);
console.log(`   GH_USER: ${process.env.GH_USER || '未配置 (使用默认值)'}`);
console.log(`   GH_REPO: ${process.env.GH_REPO || '未配置 (使用默认值)'}`);
console.log('');

// 检查 PEM 文件格式
if (process.env.GH_PRIVATE_KEY) {
    console.log('2. 检查 PEM 私钥格式:');
    const hasBegin = process.env.GH_PRIVATE_KEY.includes('-----BEGIN RSA PRIVATE KEY-----') || 
                     process.env.GH_PRIVATE_KEY.includes('-----BEGIN PRIVATE KEY-----');
    const hasEnd = process.env.GH_PRIVATE_KEY.includes('-----END RSA PRIVATE KEY-----') || 
                   process.env.GH_PRIVATE_KEY.includes('-----END PRIVATE KEY-----');
    
    if (hasBegin && hasEnd) {
        console.log('   ✓ PEM 格式正确');
    } else {
        console.log('    PEM 格式可能不正确');
        console.log('   提示: 确保私钥包含完整的 BEGIN 和 END 标记');
    }
    console.log('');
}

// 检查目标文件是否存在
const momentsFilePath = path.join(__dirname, 'public', 'moments.json');
console.log('3. 检查目标文件:');
if (fs.existsSync(momentsFilePath)) {
    console.log('   ✓ public/moments.json 存在');
    try {
        const content = fs.readFileSync(momentsFilePath, 'utf-8');
        const data = JSON.parse(content);
        console.log(`   ✓ 文件格式有效 (包含 ${Array.isArray(data) ? data.length : 0} 条记录)`);
    } catch (e) {
        console.log('    文件格式无效:', e.message);
    }
} else {
    console.log('    public/moments.json 不存在 (首次提交时会创建)');
}
console.log('');

console.log('4. 测试建议:');
console.log('   - 启动开发服务器: npm run dev');
console.log('   - 访问 http://localhost:4321/life/moments');
console.log('   - 点击"编辑模式"按钮');
console.log('   - 导入 .pem 私钥文件并输入 App ID');
console.log('   - 尝试添加/修改说说内容');
console.log('   - 点击"提交"按钮');
console.log('   - 检查浏览器控制台是否有错误信息');
console.log('');

console.log('5. 常见问题排查:');
console.log('   a) 如果显示"未认证":');
console.log('      - 确认 .env 文件中配置了 GH_APP_ID 和 GH_PRIVATE_KEY');
console.log('      - 或在浏览器中手动导入 .pem 文件');
console.log('   b) 如果提交失败:');
console.log('      - 检查 GitHub App 是否已安装到目标仓库');
console.log('      - 检查 App 权限是否包含 Contents (读写)');
console.log('      - 查看浏览器控制台的详细错误信息');
console.log('   c) 如果找不到 Installation:');
console.log('      - 确认 GitHub App 已正确安装到您的仓库');
console.log('      - 访问 https://github.com/settings/installations 检查');
console.log('');

console.log('=== 测试准备完成 ===');
