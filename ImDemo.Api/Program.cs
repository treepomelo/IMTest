using ImDemo.Api.Configuration;
using ImDemo.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. 绑定配置文件 (appsettings.json) 中的腾讯云参数
builder.Services.Configure<TencentImOptions>(
    builder.Configuration.GetSection(TencentImOptions.Position));

// 2. 注入签名服务
builder.Services.AddScoped<IUserSigService, UserSigService>();
// 【新增这一行】：将额度服务注册为单例，充当内存数据库
builder.Services.AddSingleton<QuotaService>();

builder.Services.AddControllers();

// 3. 配置允许跨域 (CORS)，防止前端 H5 或小程序联调时被拦截
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());
});

var app = builder.Build();

// 启用跨域中间件
app.UseCors("AllowAll");

// 启用路由控制器
app.MapControllers();

// 【关键优化】：绑定 0.0.0.0，允许局域网内的其他设备（如真机、微信模拟器）通过 IPv4 地址访问
// 端口 8001 与前端 common/config.js 的默认端口保持一致
app.Run("http://0.0.0.0:8001");