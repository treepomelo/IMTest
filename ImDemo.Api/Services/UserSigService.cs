using ImDemo.Api.Configuration;
using Microsoft.Extensions.Options;
using tencentyun; // 引入腾讯官方包

namespace ImDemo.Api.Services
{
    public interface IUserSigService
    {
        string GenerateUserSig(string userId, int expire = 86400 * 180);
    }

    public class UserSigService : IUserSigService
    {
        private readonly TencentImOptions _options;

        public UserSigService(IOptions<TencentImOptions> options)
        {
            _options = options.Value;
        }

        public string GenerateUserSig(string userId, int expire = 86400 * 180)
        {
            // 初始化腾讯云签名工具
            TLSSigAPIv2 api = new TLSSigAPIv2(_options.SdkAppId, _options.SecretKey);

            // 使用 GenSig 方法生成签名 [cite: 5.1.1]
            return api.GenSig(userId, expire);
        }
    }
}