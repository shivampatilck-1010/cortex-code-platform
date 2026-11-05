using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace CortexLockdown.Security
{
    public static class TelemetryDispatcher
    {
        private static string _backendUrl = "https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/lockdown/telemetry";
        private static string _sessionId = "sess_native_kiosk";
        private static string _examId = "";
        private static string _launchGrant = "";

        public static void Initialize(string backendUrl, string sessionId, string examId, string launchGrant = "")
        {
            if (!string.IsNullOrEmpty(backendUrl))
            {
                _backendUrl = backendUrl;
            }
            if (!string.IsNullOrEmpty(sessionId))
            {
                _sessionId = sessionId;
            }
            if (!string.IsNullOrEmpty(examId))
            {
                _examId = examId;
            }
            if (!string.IsNullOrEmpty(launchGrant))
            {
                _launchGrant = launchGrant;
            }
        }

        public static void DispatchEvent(string eventType, string detailsJson = "{}")
        {
            ThreadPool.QueueUserWorkItem(delegate(object state)
            {
                try
                {
                    if (string.IsNullOrEmpty(_backendUrl)) return;

                    long now = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
                    string payload = string.Format(
                        "{{\"sessionId\":\"{0}\",\"examId\":\"{1}\",\"events\":[{{\"eventType\":\"{2}\",\"timestamp\":{3},\"details\":{4}}}]}}",
                        EscapeJson(_sessionId),
                        EscapeJson(_examId),
                        EscapeJson(eventType),
                        now,
                        string.IsNullOrEmpty(detailsJson) ? "{}" : detailsJson
                    );

                    byte[] postBytes = Encoding.UTF8.GetBytes(payload);

                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(_backendUrl);
                    request.Method = "POST";
                    request.ContentType = "application/json";
                    request.ContentLength = postBytes.Length;
                    request.Timeout = 4000;

                    if (!string.IsNullOrEmpty(_launchGrant))
                    {
                        request.Headers["x-cortex-lockdown-grant"] = _launchGrant;
                    }

                    using (Stream requestStream = request.GetRequestStream())
                    {
                        requestStream.Write(postBytes, 0, postBytes.Length);
                    }

                    using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                    {
                        // Successfully recorded by edge server
                    }
                }
                catch
                {
                    // Fail gracefully on brief network interruptions
                }
            });
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
