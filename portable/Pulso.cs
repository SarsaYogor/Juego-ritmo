using System;
using System.Diagnostics;
using System.IO;

internal static class Pulso {
    private static int Main(string[] args) {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string flags = args.Length == 1 && args[0] == "--sin-navegador" ? " --sin-navegador" : "";
        try {
            var start = new ProcessStartInfo {
                FileName = Path.Combine(root, @"runtime\python.exe"),
                Arguments = "-I -B app/portable.py" + flags,
                WorkingDirectory = root,
                UseShellExecute = false
            };
            using (var server = Process.Start(start)) {
                server.WaitForExit();
                if (server.ExitCode == 0) return 0;
            }
        } catch (Exception error) {
            Console.Error.WriteLine(error.Message);
        }
        if (flags == "" && !Console.IsInputRedirected) {
            Console.Error.WriteLine("Pulsa Intro para cerrar.");
            Console.ReadLine();
        }
        return 1;
    }
}
