using System.Collections.Concurrent;

namespace ImDemo.Api.Services
{
    // 模拟数据库中的用户资产表
    public class UserAsset
    {
        public int FreeCount { get; set; } = 10;          // 默认 10 次免费
        public bool HasPurchasedCourse { get; set; } = false; // 默认未买课
    }

    public class QuotaService
    {
        // 模拟数据库，用 UserId 作为 Key
        private readonly ConcurrentDictionary<string, UserAsset> _db = new();

        /// <summary>
        /// 获取用户资产（如果没有则自动初始化为 10 次）
        /// </summary>
        public UserAsset GetUserAsset(string userId)
        {
            return _db.GetOrAdd(userId, _ => new UserAsset());
        }

        /// <summary>
        /// 扣减配额。如果已买课则直接放行；如果没买课则扣减免费次数。
        /// 返回 true 表示允许对话，返回 false 表示额度耗尽。
        /// </summary>
        public bool TryDeductQuota(string userId)
        {
            var asset = GetUserAsset(userId);

            if (asset.HasPurchasedCourse) return true; // VIP 无限畅聊

            if (asset.FreeCount > 0)
            {
                asset.FreeCount--; // 扣减一次
                return true;
            }

            return false; // 没买课且次数为 0，拦截
        }

        /// <summary>
        /// 模拟用户购买了完整课程
        /// </summary>
        public void UnlockCourse(string userId)
        {
            var asset = GetUserAsset(userId);
            asset.HasPurchasedCourse = true;
        }
    }
}