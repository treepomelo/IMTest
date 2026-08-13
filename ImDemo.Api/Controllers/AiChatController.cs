using ImDemo.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ImDemo.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiChatController : ControllerBase
    {
        private readonly QuotaService _quotaService;

        public AiChatController(QuotaService quotaService)
        {
            _quotaService = quotaService;
        }

        /// <summary>
        /// 发送消息给 AI
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendAiMessage([FromBody] AiChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserId))
                return BadRequest("UserId 不能为空");

            // 1. 核心鉴权：尝试扣减配额
            if (!_quotaService.TryDeductQuota(request.UserId))
            {
                // 触发拦截：返回 403 状态码
                return StatusCode(403, new
                {
                    code = 403,
                    message = "免费体验额度已用完，请解锁完整课程特权。"
                });
            }

            // 2. 模拟调用真实的大模型 (这里用延时模拟 AI 思考过程)
            await Task.Delay(800);
            string aiReply = $"这是 AI 虚拟助教针对【{request.Content}】的深度解答。";

            // 3. 获取最新资产状态返回给前端刷新 UI
            var asset = _quotaService.GetUserAsset(request.UserId);

            return Ok(new
            {
                code = 200,
                data = new
                {
                    reply = aiReply,
                    remainCount = asset.FreeCount,
                    isUnlimited = asset.HasPurchasedCourse
                }
            });
        }

        /// <summary>
        /// 模拟支付成功，解锁课程
        /// </summary>
        [HttpPost("buy-course")]
        public IActionResult BuyCourse([FromBody] AiChatRequest request)
        {
            _quotaService.UnlockCourse(request.UserId);
            return Ok(new { code = 200, message = "课程购买成功，已解锁无限对话特权！" });
        }
    }

    public class AiChatRequest
    {
        public string UserId { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }
}