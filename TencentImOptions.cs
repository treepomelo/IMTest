namespace ImDemo.Api.Configuration
{
    public class TencentImOptions
    {
        public const string Position = "TencentIM";

        public int SdkAppId { get; set; }
        public string SecretKey { get; set; } = string.Empty;
    }
}