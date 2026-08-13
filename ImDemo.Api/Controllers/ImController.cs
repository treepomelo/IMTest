using ImDemo.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ImDemo.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ImController : ControllerBase
    {
        private readonly IUserSigService _userSigService;

        public ImController(IUserSigService userSigService)
        {
            _userSigService = userSigService;
        }

        /// <summary>
        /// 获取腾讯云 IM UserSig
        /// </summary>
        [HttpGet("get-usersig")]
        public IActionResult GetUserSig([FromQuery] string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return BadRequest(new { code = 400, message = "UserId 不能为空" });
            }

            try
            {
                string userSig = _userSigService.GenerateUserSig(userId);

                return Ok(new
                {
                    code = 200,
                    message = "success",
                    data = new
                    {
                        userId = userId,
                        userSig = userSig
                    }
                });
            }
            catch (Exception ex)
            {
                // 生产环境建议接入日志
                return StatusCode(500, new { code = 500, message = ex.Message });
            }
        }
    }
}